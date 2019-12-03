interface ScaleResizeResponse {
  scale: number;
  width: number;
  height: number;
}

export const scaleResize = (w: number, h: number, p: Partial<ScaleResizeResponse>): ScaleResizeResponse => {
  let div;
  const d: ScaleResizeResponse = {
    scale: p.scale || NaN,
    width: p.width || NaN,
    height: p.height || NaN
  };
  if (!isNaN(d.scale)) {
    d.height = Math.round(h * d.scale);
    d.width = Math.round(w * d.scale);
  } else if (isNaN(d.width)) {
    div = d.height / h;
    d.width = Math.round(w * div);
    d.scale = div;
  } else if (isNaN(d.height)) {
    div = d.width / w;
    d.height = Math.round(h * div);
    d.scale = div;
  } else throw new Error('scaleResize: Invalid arguments');
  return d;
};
