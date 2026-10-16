# Gate lock viewer

**[Open the interactive 3D viewer](https://aeae1.github.io/gate-lock-viewer/)**

An interactive 3D viewer for the welded gate-lock mechanism. It includes the VEVOR keypad, sliding bolt, rotating inside actuator, mounting plates, keeper and stops, plus optional full gate framing, posts, wood pickets and polished copper pull handles.

The painted tubes have a gloss finish; the keypad, lock case and controls have sharper metal reflections. The sky panorama supplies the background and reflections.

## Printable mounting-plate cut wrap

**[Open the letter-size cut-wrap PDF](https://aeae1.github.io/gate-lock-viewer/print/gate-upright-cut-wrap-letter.pdf)**

Page 1 wraps around the **moving gate's latch upright** and marks both recessed mounting-plate openings. Page 2 contains setup instructions, a full-size cross-section and print-scale gauges. Print on **letter paper, landscape, 100% / Actual size**; turn off Fit, Shrink and borderless expansion. Check the scale bars and actual tube/plate dimensions before marking.

The template uses the supplied DXF's **52.93 × 152.90 mm** plate outline and **2-7/8-inch (73.025 mm) outside-diameter** pipe. It converts the plate width to a **59.207 mm surface arc**, rather than wrapping the flat plate outline onto the cylinder. Front/keypad, back/inside-lock, hinge-side and gap-side references are color coded. It includes seam alignment, plate mid-height and the spindle axis 47 mm below it. Installation height is chosen on the actual gate.

Red lines indicate the nominal finished opening, with **no added kerf or weld clearance**. Rough-cut inside and fit the actual plate; finish the long cut faces in the flat seating plane shown in the PDF. The stationary keeper post uses different geometry and is not covered by this wrap.

The reproducible drawing source is `tools/build_cut_wrap.py` (Python 3 + ReportLab). Measured and calculated dimensions are in `print/gate-upright-cut-wrap-dimensions.json`.

## Open it or send it to someone

1. Download **index.html** using GitHub's download button on the file page.
2. Open the downloaded file in a desktop browser such as Chrome or Edge.
3. Send that same file to anyone you want to show the model to. They download it and open it in their browser.

Everything needed to display the scene is inside that one HTML file. No installation, local server, GitHub account, Internet connection, external libraries or separate texture files are needed. You can rename it to `gate-viewer.html` before sending it. Browser graphics support determines whether it uses WebGL2 or the slower CPU fallback.

If an email or messaging service refuses an HTML attachment, zip the HTML file first. The recipient extracts it before opening. An attachment preview may not run the viewer; open the downloaded file in a browser.

## Controls

Fly mode is selected by default. Click the scene to enable mouse and keyboard movement. Click again to release both controls and let the stationary view keep refining. The camera stays where you left it; another click resumes movement.

| Control | Action |
| --- | --- |
| W / S | Forward / backward along the viewing direction |
| A / D | Strafe left / right |
| Shift or E | Strafe toward the top of the camera view |
| Ctrl or Q | Strafe toward the bottom of the camera view |
| Click the viewport | Toggle flight controls on/off without leaving fly mode |
| Mouse | Aim while flight controls are active; touchscreens use drag |
| Mouse wheel | Move forward/backward while flight controls are active; zoom in orbit mode |
| Esc | Alternative way to release mouse capture or leave fullscreen |
| Exit fly / Start fly | Switch between orbit and fly navigation |
| Fullscreen / F | Show only the viewport; press F again or Esc to return |
| Viewport size | Small (640 × 360), Medium (960 × 540), Large (1280 × 720), or Fit width |

Shift/Ctrl follow the camera's axes: when looking down, they move across the ground instead of along world height. E/Q provide alternatives to combinations that a browser may reserve. There is no crosshair.

Every viewport size uses a 16:9 aspect ratio and shrinks to fit smaller screens. Fullscreen hides all controls and fits the viewport inside the display, with space around it when the display has a different aspect ratio. Releasing mouse capture with a click keeps fullscreen open. F works while the viewer has keyboard focus.

Fly speeds are **Slow: 180**, **Normal: 600** (default), and **Fast: 1,800** model millimetres per second. Diagonal movement is normalized.

The view buttons preserve the selected navigation mode. Part checkboxes, full-gate checkboxes, opening animation, sky rotation, render detail and rendering pause are available below or above the scene.

Expand **Mechanism parts** to adjust each part's **Shininess** from matte (0%) to polished (100%). All eleven sliders start at **95%**, change the preview immediately, and restart progressive refinement. The plates, stops, keypad, inside lock case and actuator have independent finishes. The tube controls also affect the full frame and posts. Colors, metal types, lettering and cutaway surfaces are preserved. Adjustments stay in the current view until the page is reloaded.

## Rendering

The viewer draws a fast rasterized preview during movement, then progressively path traces the stationary view. WebGL2 is used when available; a software graphics device or CPU fallback is identified in the graphics details. A browser's GPU preference is a hint, not a guarantee that it will choose a particular device.

The path tracer uses a triangle bounding-volume hierarchy, four-bounce paths, physically based metal/dielectric materials, environment lighting and multiple importance sampling. Rendering pauses when the view is hidden. Balanced, Sharp and Ultra increase the target resolution and sample count.

Fullscreen and pointer lock depend on browser support and permissions. If either is unavailable, fullscreen fills the browser window and mouse aiming works over the viewport while flight controls are active. A second click still releases movement.

## Edit and rebuild

Only Python 3 is needed to rebuild; no packages need to be installed.

```sh
python3 build.py
```

On Windows, `py build.py` also works when the Python launcher is installed. Open the rebuilt `index.html` to inspect it. Commit both the edited sources and the rebuilt file.

| File | Purpose |
| --- | --- |
| `index.html` | Generated standalone viewer; the file to share |
| `build.py` | Dependency-free build script |
| `src/fragment.template` | Viewer structure and scoped styles |
| `src/standalone-head.html` | Standalone document header and control styles |
| `src/ui.js` | Camera, movement, animation, visibility and rendering loop |
| `src/engine.js` | Materials, geometry unpacking, BVH and CPU renderer |
| `src/gpu.js` | WebGL2 raster preview and progressive path tracer |
| `src/context.js` | Full frame, posts, wood and copper handles |
| `src/compact.json` | Embedded mechanism mesh |
| `src/full-latch-tube.json` | Full-height latch tube mesh |
| `src/sky-asset.json` | Embedded sky panorama and lighting data |

`python3 build.py --inline /path/to/viewer-fragment.html` additionally exports the inline fragment. The standalone `index.html` is the sharing format.

## Model basis

The design uses 2 7/8-inch tube, 0.21-inch wall, 1/4-inch plate, a corrected 5 mm gate/post gap, and an approximately 50-inch-wide gate. The keypad is attached to the moving gate. Full-height context and wood placement include estimates from the reference photos. This viewer is for examining the design and movement; it is not a fabrication drawing or a structural analysis.

## Publishing and sharing

The repository and hosted viewer are public. Share [the viewer link](https://aeae1.github.io/gate-lock-viewer/) with anyone; they can open it directly without a GitHub account or download. You can also send the standalone HTML file for offline viewing.

GitHub Pages publishes from the root of the `main` branch. After editing the sources, run `python3 build.py` and commit the rebuilt `index.html`; GitHub Pages deploys the committed file automatically. The `.nojekyll` file keeps the site as plain static files.
