# Gate lock viewer

**[Open the interactive 3D viewer](https://aeae1.github.io/gate-lock-viewer/)**

An interactive 3D viewer for the welded gate-lock mechanism. It includes the VEVOR keypad, sliding bolt, rotating inside actuator, mounting plates, keeper and stops, plus optional full gate framing, posts, wood pickets and polished copper pull handles.

The painted tubes have a gloss finish; the keypad, lock case and controls have sharper metal reflections. The sky panorama supplies the background and reflections.

## Open it or send it to someone

1. Download **index.html** using GitHub's download button on the file page.
2. Open the downloaded file in a desktop browser such as Chrome or Edge.
3. Send that same file to anyone you want to show the model to. They download it and open it in their browser.

Everything needed to display the scene is inside that one HTML file. No installation, local server, GitHub account, Internet connection, external libraries or separate texture files are needed. You can rename it to `gate-viewer.html` before sending it. Browser graphics support determines whether it uses WebGL2 or the slower CPU fallback.

If an email or messaging service refuses an HTML attachment, zip the HTML file first. The recipient extracts it before opening. An attachment preview may not run the viewer; open the downloaded file in a browser.

## Controls

Fly mode is selected by default. Click the scene to give it keyboard focus; click it again after using another control.

| Control | Action |
| --- | --- |
| W / S | Forward / backward along the viewing direction |
| A / D | Strafe left / right |
| Shift or E | Strafe toward the top of the camera view |
| Ctrl or Q | Strafe toward the bottom of the camera view |
| Mouse | Aim when mouse capture is available; otherwise drag to aim |
| Mouse wheel | Move forward/backward in fly mode; zoom in orbit mode |
| Esc | Release flight controls and mouse capture |
| Exit fly / Start fly | Switch between orbit and fly navigation |
| Fullscreen | Fill the display in the standalone browser version |

Shift/Ctrl follow the camera's axes: when looking down, they move across the ground instead of along world height. E/Q provide alternatives to combinations that a browser may reserve. There is no crosshair.

Fly speeds are **Slow: 180**, **Normal: 600** (default), and **Fast: 1,800** model millimetres per second. Diagonal movement is normalized.

The view buttons preserve the selected navigation mode. Part checkboxes, full-gate checkboxes, opening animation, sky rotation, render detail and rendering pause are available below or above the scene.

Expand **Mechanism parts** to adjust each part's **Shininess** from matte (0%) to polished (100%). Each slider starts at the current finish, changes the preview immediately, and restarts progressive refinement. The plates, stops, keypad, inside lock case and actuator have independent finishes. The tube controls also affect the full frame and posts. Colors, metal types, lettering and cutaway surfaces are preserved. Adjustments stay in the current view until the page is reloaded.

## Rendering

The viewer draws a fast rasterized preview during movement, then progressively path traces the stationary view. WebGL2 is used when available; a software graphics device or CPU fallback is identified in the graphics details. A browser's GPU preference is a hint, not a guarantee that it will choose a particular device.

The path tracer uses a triangle bounding-volume hierarchy, four-bounce paths, physically based metal/dielectric materials, environment lighting and multiple importance sampling. Rendering pauses when the view is hidden. Balanced, Sharp and Ultra increase the target resolution and sample count.

Fullscreen and pointer lock depend on the containing page's permissions. Restricted embedded previews can block both; the standalone file offers the full browser controls.

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
