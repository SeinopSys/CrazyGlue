import Command, { flags } from '@oclif/command';
import fs from 'fs';
import rawGm from 'gm';
import Jimp, { RGBA } from 'jimp';
import mkdirp from 'mkdirp';
import path from 'path';

import { scaleResize } from './scaleresize';

const gm = rawGm.subClass({ imageMagick: true });
const padStr = (str: string, target = 2) => str.length < target ? new Array(target).join('0') + str : str;
const rgbaToHex = (rgba: RGBA) => '#' + padStr(rgba.r.toString(16)) + padStr(rgba.g.toString(16)) + padStr(rgba.b.toString(16));

export class PickCommonPixelsCommand extends Command {
  static description =
    'Sticks images together';

  static args = [
    {
      name: 'folder',
      required: true,
    },
    {
      name: 'output',
      required: true,
    },
  ];

  static flags = {
    pass: flags.string({
      char: 'p',
      description: 'Select which pass to run\n' + [
        'Pass 1: Remove white background from all images in FOLDER and place new images in the OUTPUT folder',
        'Pass 2: Trim transparent area on the edges of all images in FOLDER and place new images in OUTPUT',
        'Pass 3: Assemble images in FOLDER into a single OUTPUT file (a PNG with transparent background)',
      ].join('\n'),
      options: ['1', '2', '3'],
      required: false,
    }),
  };

  async run() {
    const { args, flags } = this.parse(PickCommonPixelsCommand);
    const { folder: unsafeFolder, output: unsafeOutput } = args;

    const folderPath = fs.realpathSync(unsafeFolder);
    if (!fs.lstatSync(folderPath).isDirectory()) {
      this.error(`${folderPath} is not a directory or you don't have permission to access it`);
      return this.exit(1);
    }

    let outputPath: string;
    if (!fs.existsSync(unsafeOutput)) {
      this.log(`${unsafeOutput} is not a directory, creating\u{2026}`);
      mkdirp.sync(unsafeOutput);
      outputPath = unsafeOutput;
    } else {
      outputPath = fs.realpathSync(unsafeOutput);
    }
    if (flags.pass !== '3') {
      if (!fs.existsSync(outputPath)) {
        this.log(`${outputPath} is not a directory, creating\u{2026}`);
        mkdirp.sync(outputPath);
      } else if (!fs.lstatSync(outputPath).isDirectory()) {
        this.error(`${outputPath} is not a directory or you don't have permission to access it`);
        return this.exit(1);
      }
    }

    try {
      fs.accessSync(outputPath, fs.constants.W_OK);
    } catch (e) {
      this.error(`${outputPath} is not writable: ${e.message}`);
      return this.exit(1);
    }

    let images: string[];
    try {
      images = fs.readdirSync(folderPath).filter(file => /\.(png|jpe?g)$/.test(file)).sort();
    } catch (e) {
      this.error(`Failed to read images in ${folderPath}`);
      this.error(e);
      return this.exit(1);
    }

    if (images.length === 0) {
      this.error(`No PNG or JPEG images found in ${folderPath}`);
      return this.exit(1);
    }
    this.log('Found images: ' + images.join(', '));

    const manipulate = (attachFn: (arg: rawGm.State, path: string) => Promise<rawGm.State>) =>
      images
        .map(fname => () => new Promise<any>(async (res, rej) => {
          const inpath = folderPath + path.sep + fname;
          const outpath = outputPath + path.sep + (fname.replace(/\.jpe?g/, '.png'));
          this.log(`Reading ${inpath}`);
          const manipulated = await attachFn(gm(inpath).command('magick'), inpath);
          manipulated.write(outpath, (err: any) => {
            if (err)
              return rej(err);

            this.log(`Written ${outpath}`);
            res();
          });
        }))
        .reduce((acc: Promise<any>, el: () => Promise<any>) => acc.then(el), Promise.resolve());

    switch (flags.pass) {
    case '1':
      await manipulate(async (instance, path) => {
        const memCopy = await Jimp.read(path);
        const topLeftPixelColor = Jimp.intToRGBA(memCopy.getPixelColor(0, 0));

        // Ignore images whose top left pixel is transparent
        if (topLeftPixelColor.a === 0) {
          this.log('Flod fill skipped due to transparent top left pixel');
          return instance;
        }

        const tlHex = rgbaToHex(topLeftPixelColor);
        const border = [5, 5];
        this.log(`Top left pixel HEX color: ${tlHex}`);
        return instance
          .borderColor(tlHex)
          .border(border[0], border[1])
          .channel('RGBA')
          .fuzz(50, true)
          .fill('none')
          .draw('alpha 0,0 floodfill')
          .shave(border[0], border[1]);
      });
      break;
    case '2':
      await manipulate(instance => Promise.resolve(
        instance
          .trim()
          .out('+repage')
      ));
      break;
    case '3':
      const percentageOfOverlap = 0.45;
      const subImages = await Promise.all(images.map(fname => Jimp.read(folderPath + path.sep + fname)));
      let totalImageWidth = 0;
      let imgHeights: number[] = subImages.map(image => image.getHeight());
      // Pick smallest image size as image height (keeping a minimum of 200px)
      const totalImageHeight = Math.max(Math.min(...imgHeights), 200);
      let imgWidths: number[] = [];
      let imgOffsets: number[] = [];
      subImages.forEach((image, i) => {
        const size = scaleResize(image.getWidth(), imgHeights[i], { height: totalImageHeight });
        imgWidths.splice(i, 1, size.width);
        if (i === 0) {
          totalImageWidth = size.width;
          imgOffsets.push(0);
        } else {
          const offset = imgWidths[i - 1] / (1 / percentageOfOverlap);
          imgOffsets.push(totalImageWidth - offset);
          totalImageWidth += size.width - offset;
        }
      });
      const baseImage = await Jimp.read(totalImageWidth, totalImageHeight);
      const composite = subImages.reduce((acc, image, i) => {
        return acc.composite(image.resize(imgWidths[i], totalImageHeight), imgOffsets[i], 0);
      }, baseImage);
      if (outputPath.substr(-4) !== '.png') {
        outputPath += '.png';
      }
      composite.write(outputPath);
      break;
    default:
      this.error(`Pass ${flags.pass} not supported`);
    }

    this.log(`Pass ${flags.pass} completed succesfully`);

    /*
    let image: Jimp | null = null;
    let error;
    try {
      image = await Jimp.read(firstImagePath);
    } catch (e) {
      error = e;
    }

    if (error || image === null) {
      this.error(error);
      return this.exit(1);
    }
    const [firstImageWidth, firstImageHeight] = [firstImage.getWidth(), firstImage.getHeight()];
    const [secondImageWidth, secondImageHeight] = [secondImage.getWidth(), secondImage.getHeight()];
    const [outputImageWidth, outputImageHeight] = [Math.max(firstImageWidth, secondImageWidth), Math.max(firstImageHeight, secondImageHeight)];
    if (firstImageWidth !== secondImageWidth || firstImageHeight !== secondImageHeight) {
      this.log(`The provided images re not of the same resolution (got ${firstImageWidth}x${firstImageHeight} and ${secondImageWidth}x${secondImageHeight})`);
      return this.exit(1);
    }

    let outputImage: Jimp = new Jimp(outputImageWidth, outputImageHeight, 0, err => {
      if (err) {
        error = err;
      }
    });

    if (error) {
      this.error(error);
      return this.exit(1);
    }
    const outputImageIter = outputImage.scanIterator(
      0,
      0,
      firstImage.bitmap.width,
      firstImage.bitmap.height
    );
    for (const { x, y } of outputImageIter) {
      const firstImagePixel = firstImage.getPixelColor(x, y) || 0;
      const secondImagePixel = secondImage.getPixelColor(x, y) || 0;
      outputImage.setPixelColor(PickCommonPixelsCommand.availablePasses[flags.mode](firstImagePixel, secondImagePixel), x, y);
    }

    try {
      await outputImage.writeAsync(outputImagePath);
    } catch (e) {
      this.error('Failed to write image');
      this.error(e);
      return this.exit(1);
    }
    this.log(`Image written to ${outputImagePath}`);*/
  }
}
