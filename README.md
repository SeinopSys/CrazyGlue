CrazyGlue
=======

Glues together images

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/SeinopSys/CrazyGlue/blob/master/package.json)

# Dependencies

ImageMagick must be installed and available from the system `PATH`. You can easily verify this by running `magick --version` in a terminal, if you see something like the following you are good to go:

```
magick --version
Version: ImageMagick 7.0.9-7 Q16 x64 2019-11-30 http://www.imagemagick.org
Copyright: Copyright (C) 1999-2018 ImageMagick Studio LLC
License: http://www.imagemagick.org/script/license.php
Visual C++: 180040629
Features: Cipher DPC Modules OpenCL OpenMP(2.0)
Delegates (built-in): bzlib cairo flif freetype gslib heic jng jp2 jpeg lcms lqr lzma openexr pangocairo png ps raw
 rsvg tiff webp xml zlib
```

If you get a command not found error or something of that sort then you need to install ImageMagick from https://imagemagick.org/script/download.php

If you are using Windows you may need to restart your PC after installation for the command to work.

# Using the command

 1. Clone this repository using Git or download the zip archive and extract it to a folder of your choice.
 
 2. Install Nodejs from https://nodejs.org/en/ (reboot may be required afterwards on Windows)
 
 3. Run `npm install` then `npm link`
 
 4. You should now be able to execute `crazyglue --help` from any command window (which should display the command's help text if everything is set up correctly)

# Usage

This command accomplishes the task of packing images in 3 stages, where during the 1st and 2nd stages manual processing may need to be done on the images to remove things that could cause the process to go awry.

This can happen when an image has a noisy background (e.g. a photo) or if there is additional text on the image around subject that should not be present on the final cut. Due to the difficulty of automating photo background and text removal this still needs to be done manually, but the rest of the process can be automated using this command.

Run `crazyglue --help` to see precisely how to use the command and what each pass does.

**Example:**

```
$ crazyglue -p1 pack-A pack-A-nobg
$ crazyglue -p2 pack-A-nobg pack-A-crop
$ crazyglue -p3 pack-A-crop pack-A.png
```

After each pass the images should be manually inspected for any anomalies and the pass should be re-run once the anomalies are identified and fixed.

While it's possible to work from and output to the same directory it's not advised as this would render the process irreversible and you would need to start over with a fresh copy if the images. By doing the passes incrementally you can always rerun the commands with different folders to reproduce the same results.
