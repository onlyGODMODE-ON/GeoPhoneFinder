/** Builds the `cameras` object of a spec-catalog entry. main = [mp, sensorSizeInch, aperture, ois]. */
export const cam = ({ main, uw = null, tele = null, front }) => ({
  main: { mp: main[0], sensorSizeInch: main[1], aperture: main[2], ois: main[3] },
  ultrawide: uw ? { present: true, mp: uw } : { present: false, mp: null },
  telephoto: tele ? { present: true, mp: tele[0], opticalZoom: tele[1] } : { present: false, mp: null, opticalZoom: null },
  opticalZoomMax: tele ? tele[1] : 1,
  front: { mp: front[0], autofocus: front[1] },
});
