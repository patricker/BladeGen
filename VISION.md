# Web-Based Sword Generator System Design Plan

## Architecture of the Application (Frontend & Components)

The sword generator will be a **web-based interactive app** built with Three.js for 3D rendering. The frontend stack can use a modern JS bundler (e.g. Vite or Webpack) and optionally a UI framework (like React/Vue) for structuring the UI, though plain HTML/JS with Three.js and a UI library (e.g. dat.GUI or custom sliders) is also viable. Key architectural components include:

* **Three.js Scene and Renderer:** A single HTML \<canvas\> for WebGL rendering, managed by Three.js. A main Scene contains the sword model (assembled from sub-meshes for blade, hilt, guard, pommel) and lighting. A PerspectiveCamera and OrbitControls allow the user to rotate/zoom the view in real-time.

* **UI Layer:** A panel of controls (30–50 sliders, toggles, and knobs) organized into categories (Blade, Hilt/Guard, Pommel, etc.) for adjusting parameters. This UI will likely be built in standard HTML/CSS (for full layout control) or using a lightweight GUI library. The UI runs in the DOM, overlaying or beside the canvas, and communicates with the Three.js scene (e.g. updating parameters on input events). Immediate feedback is critical – as the user moves a slider, the 3D view updates within \~0.1 seconds to reflect changes[\[1\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=Sliders%20are%20effective%20when%20users,the%20results%20of%20the%20change).

* **Application State & Components:** The app maintains a **state object** for all sword parameters. This can be a JavaScript object (or reactive state if using a framework) that stores values like bladeLength, bladeWidth, guardWidth, handleLength, etc. Each category of controls updates its portion of the state. The sword itself can be represented as a class or module (e.g. a SwordGenerator class) which holds a Three.js Group containing sub-meshes for each part. This class provides methods like updateGeometry(params) to rebuild or adjust the meshes when parameters change. Internally, it may have helper components or classes for each part (Blade, Guard, Handle, Pommel) to encapsulate the geometry generation for that part.

The rendering logic is structured so that **each animation frame** (using requestAnimationFrame) checks if any parameters changed (or simply always re-renders). When a slider is moved, the app updates the corresponding parameter and either adjusts the mesh (for simple transforms) or triggers a regeneration of that part’s geometry. The system ensures **real-time interaction** – for example, if a blade length slider is dragged, the blade mesh stretches or rebuilds continuously, giving immediate visual feedback. This real-time loop and responsive design adhere to good UX practice for sliders[\[1\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=Sliders%20are%20effective%20when%20users,the%20results%20of%20the%20change).

## Parameter System and Presets

To manage the 30–50 adjustable properties, parameters are grouped into logical **categories** so the UI remains navigable. We can define categories such as:

* **Blade Parameters:** Length, width, thickness, curvature, tip shape (pointed, rounded, etc.), edge style (straight, serrated amount), blade profile (e.g. symmetry or single-edged), etc.

* **Guard (Crossguard) Parameters:** Width (span of the guard), thickness, curvature or angle (e.g. straight guard or curved towards blade), prong length if any, guard style presets (simple bar, ornate wings, spikes).

* **Handle/Grip Parameters:** Length of the handle, radius/thickness, handle wrap texture/style (could be discrete options), grip shape profile (straight, tapered).

* **Pommel Parameters:** Size (radius), shape (round, disk, faceted, spike), length of pommel (if it’s elongated or spiked), and possibly pommel angle or orientation.

* **Decorative/Material Options:** (Optional category) Surface materials or colors, engravings or pattern toggles, emissive glow for “magical” swords, etc. These might be knobs or color pickers rather than sliders.

Each parameter in state directly influences the sword’s geometry or appearance. For example, the **“Blade Length”** slider might range from a short dagger length up to an absurdly long fantasy sword length. Changing this value will update the blade’s geometry (either by scaling the mesh or regenerating it with the new dimensions). The parameters can have wide ranges to allow extreme fantasy proportions – for instance, blade length might go from, say, 0.5m up to 5m in the UI, far beyond realistic sword lengths, to enable dramatic oversized blades.

**Presets System:** The app will include a robust preset system to quickly load base sword archetypes. Each preset is essentially a stored set of parameter values that define a particular style. For example:

* *Katana:* bladeLength large, bladeWidth small, curvature moderate, single-edged profile, long handle, minimal guard.

* *Claymore:* bladeLength medium-high, bladeWidth broad, straight double-edged blade, crossguard width medium, shorter handle, heavy pommel.

* *Rapier:* very long blade but very thin, maybe a complex guard (cup or looping bars – which might be represented by certain param toggles), small pommel, etc.

* *Fantasy Demon Blade:* extreme values – e.g. very large blade with jagged edges (high serration param), perhaps a crooked curvature, an oversized guard with spikes, etc.

These presets can be presented as buttons or a dropdown. Selecting a preset will **apply a batch of parameter values** to the state, update all the sliders accordingly, and refresh the 3D view to show the new sword. This gives users a quick starting point which they can then tweak. Technically, presets could be stored as JSON objects or simply hardcoded param dictionaries. The UI should also allow saving the user’s custom presets (so they can create and recall their own designs).

To ensure users aren’t overwhelmed by 50 controls at once, the UI might initially load a chosen preset (so a sword appears immediately) and then allow drilling down into categories to adjust details. Presets also help illustrate the range of possibilities (from realistic to fantastical) at a single click.

## Procedural Geometry Generation (Mapping Parameters to Geometry)

The core of the system is procedurally generating the sword’s 3D geometry based on the parameters. We avoid using only simple primitives (no one-size box for blade, etc.) – instead we employ **parametric modeling techniques** with Three.js. Each part of the sword is constructed algorithmically:

* **Blade Geometry:** Rather than a stretched cube, the blade can be created by **extruding a 2D shape**. For example, define a blade cross-section outline in the X–Y plane and extrude it along the Z-axis for thickness. The outline could be a trapezoid (for a double-edged blade that tapers towards the tip) or a more complex shape for single-edge. Parameters like length and width directly set the outline’s dimensions. For instance, a simple implementation might use THREE.Shape() to draw a rectangle of width \= bladeWidth and length \= bladeLength, then call new THREE.ExtrudeGeometry(shape, { depth: bladeThickness, bevelEnabled: false }) to create a prism[\[2\]](https://threejs.org/docs/api/en/geometries/ExtrudeGeometry.html#:~:text=,add%28%20mesh%20%29%3B). In code, using parameters it would look like:

const shape \= new THREE.Shape();  
// outline a rectangle or polygon based on blade width/length  
shape.moveTo(0, 0);  
shape.lineTo(0, params.bladeWidth);  
shape.lineTo(params.bladeLength, params.bladeWidth);  
shape.lineTo(params.bladeLength, 0);  
shape.closePath();  
const extrudeSettings \= { depth: params.bladeThickness, bevelEnabled: false };  
const newBladeGeom \= new THREE.ExtrudeGeometry(shape, extrudeSettings);  
bladeMesh.geometry.dispose();               // remove old geometry  
bladeMesh.geometry \= newBladeGeom;          // apply new geometry to the blade mesh

In this snippet, params.bladeLength and params.bladeWidth come from the UI sliders, and we rebuild the blade accordingly (closing the shape to form a 2D blade profile and extruding it to 3D). The Three.js example for ExtrudeGeometry similarly demonstrates using variables for length/width to define the shape[\[2\]](https://threejs.org/docs/api/en/geometries/ExtrudeGeometry.html#:~:text=,add%28%20mesh%20%29%3B). More advanced: we can incorporate **blade taper** (so the tip is narrower than the base) by modifying the shape outline or using multiple shape keys. We could also allow a *curved blade* by using an extrudePath: for example, if a curvature parameter is set, create a curved THREE.Curve (like a quadratic bezier or spline) and supply it as the extrudePath so the blade follows that curve. This would bend the blade smoothly. If curvature is zero, we extrude straight; if high, we extrude along a curved path to get a dramatically curved sword (for instance a scimitar shape). Similarly, a *wavy or serrated blade* can be achieved by programmatically modulating the edge: e.g., use a sine wave to offset the outline’s edge points if a “serration” amplitude parameter \> 0\.

* **Guard (Crossguard) Geometry:** The guard can be generated procedurally, potentially by symmetry. One approach is to model one half of the guard and mirror it. For example, define a simple crossguard shape – could start as a rectangular bar centered on the blade. The guardWidth parameter would set half the length on each side of the blade. We can create a small shape (like a rectangle or custom curve) and extrude it for thickness similar to the blade, or even use simpler geometries (a stretched box) if the guard shape is simple. For more ornate guards (like quillons or curved guards), we might use a curve path or a combination of primitives: e.g., a param for *guard curve* that rotates the guard tips upward or downward. In code, if simplicity is fine, one could use new THREE.BoxGeometry(guardWidth, guardThickness, guardDepth) and then perhaps apply a rotation or slight bend. But for higher fidelity, using ExtrudeGeometry or even Lathe (for round guards) could be better. The guard’s *style presets* might select different generation algorithms: e.g., a *“cross” guard vs “wing” guard*, etc., by toggling which shape to extrude or which object to generate. Because the guard is symmetric, often generating one side and cloning it (mirroring on the Y axis) is useful — the two halves can then be merged or kept as separate mirrored meshes in the group.

* **Handle/Grip Geometry:** Many sword handles are roughly cylindrical. We can use THREE.CylinderGeometry or, more generally, **LatheGeometry** to get a nicely rounded grip. For example, define a profile curve (2D outline of the grip’s radius along its length) and revolve it 360° using new THREE.LatheGeometry(points, segments). The handleLength parameter sets the height of the cylinder or length of the profile curve, and handleThickness sets the radius. If we want a tapered handle (thicker at one end), the profile points can reflect that (e.g. a slight cone shape). The handle might also have a *wrap pattern* – if just visual, it could be a texture; if geometric (like ridges), we might procedurally add a helix or bumps along it. Those could be advanced options toggled by the user. Initially, a simple cylinder with the given dimensions will suffice, possibly with a high radial segment count if smoothness is needed.

* **Pommel Geometry:** Pommels can often be basic shapes – e.g., a sphere, a disk, or a faceted gem. We can allow a selection or a parameter that morphs the pommel shape. For simplicity, we might treat pommel shape as discrete options (like a dropdown: none, sphere, disk, spike). However, it can also be continuous if we get creative: for example, use a sphere geometry for a round pommel (with a radius param). For a “disk” pommel, use a short cylinder (with radius param and small height). For a spike pommel, perhaps a cone geometry. We can then allow the *pommel size* slider to uniformly scale these shapes. The param system could simply swap the geometry type based on a “pommelStyle” selection. But since the question suggests all parameters are sliders/knobs, we might include a few that control pommel appearance: e.g., *pommel radius*, *pommel length* (for elongating into a spike), etc. By manipulating those, a user could effectively create different shapes (e.g. set radius large and length very short \-\> flat disk; set radius small and length long \-\> spike; medium radius & medium length \-\> more rounded or bulbous). Internally, implementing the pommel could involve starting with a base geometry (say a sphere) and scaling it non-uniformly (scale X/Y vs Z differently to turn sphere into a flattened disk or elongated ovoid).

Each part’s mesh is parented to a master Sword group so they move together. Their positioning relative to each other is important: for example, the blade’s base should align with the guard’s center. The guard and handle should attach at the blade base. This means when blade length changes, we might need to reposition the guard/handle group so it remains at the new blade base (though if our blade is built from Y=0 at hilt to Y=length at tip, and guard is positioned at Y=0, changes in length won’t affect guard position). If using a centered origin, we adjust accordingly.

**Parameter Mapping Example:** Suppose the user increases the *Blade Length* slider. In our system, this could trigger either a simple scale or a rebuild: \- *Scaling approach:* We could simply set bladeMesh.scale.x (assuming blade length is along the X-axis in our shape definition) to the new length factor. This is fast and avoids re-creating geometry. However, non-uniform scaling might also scale the width unless the geometry’s orientation is managed carefully. If the blade was initially modeled of unit length, scaling X stretches it. This is easy, but if we want, say, consistent blade tip shape or certain details that should not scale, scaling might distort them. \- *Rebuild approach:* As shown above, we re-generate the ExtrudeGeometry with the updated length value[\[2\]](https://threejs.org/docs/api/en/geometries/ExtrudeGeometry.html#:~:text=,add%28%20mesh%20%29%3B). This ensures, for example, the number of subdivisions along the blade can remain consistent (rather than stretched polygons). The downside is a slight performance cost for creating new geometry. We dispose of the old geometry to free memory. Given that user adjustments are interactive, we should ensure regeneration is efficient (perhaps only a few hundred vertices, which is fine).

Another example: adjusting *Guard Width* – this could be as simple as repositioning the guard’s end vertices. If the guard is a box, we can set its scale X to the new width factor. If it’s an extruded shape, we might regenerate or adjust the shape’s points that control half-width. Similarly, *Handle Length* could be done by scaling the cylinder, since a cylinder geometry’s height can be scaled without adverse effects (its radius remains constant if we only scale length axis). This is an optimization: not every param change requires a full rebuild; some can use Three.js object transforms (scale, rotation) to achieve the effect. The development plan would identify which parameters are purely geometric (needing recomputation of vertices) vs which are affine transformations.

Given that geometry is more advanced than primitives, we rely on **procedural algorithms**: extruding shapes, revolving profiles, combining simple forms, and even using noise or math for exotic features. All of these are driven by the user’s numeric inputs. The result is a **highly parametric sword model** – essentially a function of \~50 variables that produces a mesh. By adjusting those variables, we cover a vast space of sword designs. (In fact, with dozens of parameters the combination space is astronomical, as noted in procedural generation discussions[\[3\]](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449#:~:text=In%20the%20particular%20project%20we,the%20next%20number%20of%20options), so our system dynamically creates the model rather than storing any pre-made models.)

## Real-Time Rendering and Interaction

To make the experience smooth, the application will use Three.js’s rendering loop for **real-time updates**. We set up renderer.setAnimationLoop() or use requestAnimationFrame(render) to continuously render the scene. Each frame, the sword model is drawn with the current parameters. As sliders change, the corresponding parameters update and the sword’s mesh is updated (either via scaling or replacing geometry as described). We do not necessarily rebuild everything every frame – we can update on an onChange event of each control to be more efficient. However, the continuous rendering ensures that even if the user is actively dragging a slider, the model will animate smoothly following the input.

The scene will include appropriate lighting to highlight the sword’s shape (for example, an ambient light plus a directional light to cast some specular highlights on edges). We might also include a simple ground plane or skybox for context, but the focus is the sword. A neutral background or environment map can be used so that metallic or reflective materials on the sword look good.

User interaction aside from sliders includes the ability to **rotate the camera** around the sword. We will enable OrbitControls so the user can tumble the view, zoom in/out, and inspect the sword from all angles. This control should be active simultaneously with the UI – e.g. the user can adjust a slider and then use the mouse to orbit, etc. We must ensure the UI doesn’t block the canvas interaction (common solution: place the sliders in a sidebar or overlay but not full-screen, so clicking and dragging on empty canvas space still engages OrbitControls).

Performance considerations: With procedural geometry, updating 50 parameters in worst case could be heavy if we rebuild everything at once. We can optimize by *debouncing* some controls – for instance, if a user is dragging a slider rapidly, we could update geometry at some interval (like every few animation frames or on mouseup) for very expensive operations. But ideally, all changes should reflect immediately to fulfill the creative exploration aspect. Most geometry will be moderate in polygon count (we can keep things low-poly unless high detail is needed for silhouette). A modern browser should handle regenerating a few meshes per frame. We will test and profile to avoid noticeable lag. Ensuring **immediate visual feedback** is crucial because sliders are effective only when the response is instant and continuous[\[1\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=Sliders%20are%20effective%20when%20users,the%20results%20of%20the%20change) – if a complex change (like switching a high-detail guard style) causes a delay, we might need to indicate loading or prevent doing it on every tiny slider move (e.g. apply on release).

In summary, the rendering system will run at interactive frame rates, with user inputs tied directly into the Three.js scene updates. This tight feedback loop makes the tool feel responsive and allows playful exploration of extreme designs.

## Export to Blender (GLTF Format Implementation)

Exporting the designed sword for use in Blender or other tools will be handled via Three.js’s **GLTFExporter**. The GLTF format is ideal as it retains geometry, materials, and is widely supported (Blender can import glTF/GLB files easily). We will provide an “Export” button that packages the current sword model into a .glb file.

Under the hood, clicking export will call the GLTFExporter on our sword object (or the whole scene). For example, we instantiate the exporter and call exporter.parse on the sword’s Group:

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const exporter \= new GLTFExporter();  
exporter.parse(  
    swordGroup,   
    function(result) {  
        // result is either JSON or ArrayBuffer depending on options  
        if(result instanceof ArrayBuffer) {  
            // Binary glTF (.glb)  
            const blob \= new Blob(\[result\], { type: 'model/gltf-binary' });  
            saveBlob(blob, 'MySword.glb');  
        } else {  
            // JSON glTF  
            const json \= JSON.stringify(result, null, 2);  
            const blob \= new Blob(\[json\], { type: 'text/plain' });  
            saveBlob(blob, 'MySword.gltf');  
        }  
    },  
    function(error) {  
        console.error('Export error', error);  
    },  
    { binary: true }  
);

In the above, saveBlob is a helper to trigger a file download (e.g. using an \<a\> element or FileSaver library). We pass the option { binary: true } to get a binary .glb file[\[4\]](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424#:~:text=const%20exporter%20%3D%20new%20GLTFExporter)[\[5\]](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424#:~:text=%2F%2F%20called%20when%20the%20gltf,result%29). The exporter will traverse the swordGroup (which contains blade, guard, etc. meshes) and produce a single glTF asset. All geometry and material data is included. By default, textures (if any) can be embedded or referenced; in our case we might only have simple materials (e.g. colored metal) so embedding is fine.

Three.js’s docs confirm the usage: GLTFExporter will generate the glTF content and then we can download it (for example, the Three.js example code logs or downloads the JSON[\[6\]](https://threejs.org/docs/examples/en/exporters/GLTFExporter.html#:~:text=,options%20%29%3B)). In our implementation, we’ll directly trigger a download named like sword.glb. This allows the user to **import the sword into Blender** or any other 3D software. The GLTF exported model will preserve the shape exactly as seen. If we have applied any non-standard materials or textures, we ensure they are compatible (GLTFExporter supports PBR materials, etc., and includes common Three.js material properties automatically).

We must note that certain dynamic aspects (if any) wouldn’t carry over – but in this case, our sword is static geometry, so no issues. Animations are not a concern unless we later add an animation (like a swinging sword) which is out of scope here. The export will just capture the static mesh configuration at the moment of export.

By using glTF, we ensure the **exported file is efficient and standardized**. The user can open it in Blender with correct scale and orientation (we’ll have to be mindful of units and axes – Three.js default units could be considered meters or arbitrary, and Z is up vs Blender’s Y up; we might adjust or document any axis differences). Overall, GLTF export is straightforward with the library[\[4\]](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424#:~:text=const%20exporter%20%3D%20new%20GLTFExporter), and it fulfills the requirement of providing a Blender-compatible format.

## Design Principles for Extreme Fantasy Styles

One of the goals is to support **extreme fantasy designs** – swords that defy realism with impossible proportions and wild silhouettes – while still giving the user meaningful control. Here are key design principles to achieve this combination of freedom and usability:

* **Broad Parameter Ranges:** Define slider ranges that go beyond normal sword values. For example, a blade width slider might normally be 1–10 cm for realistic blades; we might allow it to go up to 50 cm or more to create gigantic cleaver or paddle-like blades. A handle length might extend to absurd two-handed lengths or be almost non-existent. By offering a wide range, users can push a design into exaggerated territory. We should set a reasonable default (for usability) but let the extremes be accessible for those who want them. Some parameters might even allow values that produce comically unusable designs (a sword with a 10-foot wide guard, or a blade thin as a needle) – this is part of the fun in a fantasy generator.

* **Maintaining Geometric Stability:** Even as we allow extreme proportions, we must ensure the geometry generation can handle them. Very thin or very long aspects might cause clipping or precision issues. We need to test edge cases (like a maximum-length, maximum-curvature blade) to ensure it still renders without the mesh self-intersecting or disappearing due to camera near/far planes. Some extreme combos might produce *degenerate geometry* (e.g., a zero-length blade, or a negative curvature if allowed) that breaks the model. The system should either **prevent** truly invalid inputs or apply constraints behind the scenes. For example, we don’t allow a parameter to be set such that it makes no sense (the app could enforce a minimum \> 0 for lengths, etc.). As one source on procedural design suggests, not all combinations of parameters will make sense and it’s wise to impose restrictions or rules to avoid impossible models[\[7\]](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449#:~:text=Reducing%20the%20space%20of%20variations,with%20Rules). We can incorporate a **validation layer**: if a user picks an inconsistent set (say, a guard that is extremely large relative to a tiny blade), the tool might highlight this or auto-adjust something (or simply allow it if it’s just for aesthetics). A non-intrusive approach is to show a warning icon or tooltip when a combination is outlandish, rather than hard block it – keeping user freedom but guiding them. The idea of parameter validation and warnings is used in professional parametric design tools[\[8\]](https://www.ideastatica.com/support-center/ux-features-in-parametric-design#:~:text=,warning%20or%20error%20icon%20displays); we can emulate that lightly. For instance, if *bladeThickness* is set extremely high while *bladeLength* is extremely low, we could flag that the sword may look more like a club than a blade (which might be fine, but the user should know the limits).

* **Stylistic Coherence vs User Control:** In a creative tool, we want users to explore crazy designs, but also we can provide *optional coherence rules*. One principle is **linking certain parameters** when it makes sense, with an option to unlink for full manual control. For example, to preserve some semblance of proportion, by default the guard width might auto-scale a bit with blade length (since a very long blade typically has a wider guard in actual swords). But we could allow the user to disable this linkage and set each independently, enabling “impossible” ratios. This gives a newbie user a sensible starting behavior (the sword doesn’t look completely off by default) while experts can break the rules deliberately. Another example: if a preset is chosen (like Rapier with a slender blade), we might temporarily lock certain parameters (like not letting blade width go to the maximum unless they switch off preset mode) – or simply the preset defines a narrower range for that style. However, since the question emphasizes impossible proportions, our approach leans towards *allowing maximum flexibility*. So we likely won’t clamp too much; rather we ensure the generator logic can handle it.

* **Embracing Creative Extremes:** We also design parameters that specifically enable fantasy flourishes. For instance, a “*Blade Chaos*” parameter could introduce random noise or jaggedness along the blade outline. At 0, the blade is clean; at high values, it gains exaggerated spikes or waviness (useful for demon or organic-looking swords). This introduces non-realistic features that the user controls in magnitude. Similarly, a “*Symmetry*” toggle could allow asymmetrical designs (perhaps one side of the blade has a different shape than the other, which real swords avoid for balance, but a fantasy corrupted blade might do). Providing these options means even without modeling skill, users can apply a preset crazy effect.

* **Preset Extreme Examples:** We include at least one preset like the *Fantasy Demon Blade* that pushes parameters to extreme ends. This serves as a showcase of the wild end of the spectrum and inspires users to tweak further. From that preset, users can dial it back if needed. By shipping some intentionally over-the-top designs, we set the expectation that extremes are part of the tool’s purpose.

* **Visual Feedback and Iteration:** When the user experiments with extremes, immediate feedback (as discussed) helps them fine-tune. If a sword looks off-balance (say a huge blade on a thin handle), they can see it and perhaps adjust other parameters to compensate (like increasing handle thickness). The UI could offer hints like *“try increasing X for balance”* if certain ratios are very abnormal, but that might over-complicate. A simpler method is to let the *physics or plausibility entirely up to the user’s imagination* – since it’s fantasy, a sword can be implausible and still cool. Our job is mostly to not crash and to keep the mesh visually reasonable (no inverted normals, holes, etc.).

In summary, the design principle is **freedom with some safeties**: we give users a very large design space (supporting dramatic silhouettes well beyond historical swords), and use minimal but smart constraints or warnings to avoid truly broken results. This way, a user can create an impossible sword that still looks intentional. By combining extreme parameter ranges with user-friendly presets and slight behind-the-scenes guidance, we accommodate both **creative exploration and control** in equal measure.

## UI/UX Structure for Parameter Controls

With dozens of controls available, the UI must be structured to avoid overwhelming the user. We achieve this with clear categorization, progressive disclosure, and user-friendly layout:

* **Categorized Panels:** The parameters are divided into major sections as discussed (Blade, Guard, Handle, Pommel, etc.). In the interface, these can be presented as **collapsible accordions or tabs**. For example, a sidebar might list: **Blade**, **Guard**, **Handle**, **Pommel**, **Other**. When the user clicks “Blade”, it expands to show all blade-related sliders, while the others stay collapsed. This way only \~10 controls are visible at once instead of 50, reducing cognitive load. Each category can also have a brief description or even an icon (e.g. a small blade icon next to “Blade” section) to make it recognizable.

* **Logical Grouping & Labels:** Inside each category, controls are ordered in a logical build sequence. For instance, Blade might have length, width, thickness at the top (primary dimensions), then shape modifiers like curvature, tip shape, then edge details like serration frequency, etc. Grouping related sliders together and labeling them clearly (and possibly with units or descriptive text) is important. For instance: “Blade Length (cm)” or “Blade Length (relative)” if we use arbitrary units. Short tooltips can explain what each control does, especially for less obvious ones (e.g. “Curvature: bends the blade along an arc”).

* **Slider Design Considerations:** Since many controls are sliders/knobs, we ensure they are **intuitive to use**. Each slider should have a sensible default (probably the preset’s value or a mid-range value) and allow easy reset (like double-click or a reset button). For fine-grained control, consider linking a numeric input field with the slider so that users can type an exact value if needed. Given that some parameters have large ranges, a slider might be nonlinear or have a large width to improve precision. The Nielsen Norman guidelines note that sliders excel when users can quickly scan through effects, but precise selection can be hard[\[9\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=Summary%3A%C2%A0%20Linked%20controls%20support%20coarse,ease%20of%20exploration%20and%20precision)[\[10\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=,precisely%20choose%20a%20specific%20value). In our context, precise values aren’t usually critical (it’s more aesthetic), so sliders are appropriate, but we might still allow arrow keys or direct input for those who want exact repeatability.

* **Presets and Randomize in UI:** At the top of the UI, we’ll provide a presets menu. This could be a row of buttons with names (“Katana”, “Claymore”, etc.) or a dropdown list. Selecting one immediately updates the sliders (which visibly move to the preset’s values) and updates the model. Alongside presets, a **“Random”** button can be fun – pressing it assigns random values to all parameters (perhaps within a subset of ranges or around a theme) to generate a completely random sword. This offers inspiration and showcases the extremes. We must be cautious to still produce a somewhat coherent result; we might constrain randomization to avoid the most nonsensical outcomes unless that’s desirable. For example, random could operate within two modes: realistic range vs full-range. Regardless, a user who hits random should be able to then tweak any resulting design.

* **User Guidance and Defaults:** To avoid first-time users being lost, the UI should load with a default sword (maybe a common longsword). From there, the user can modify. The controls can include visual cues – for example, when a category is selected, we could highlight that part of the sword in the 3D view (e.g. briefly outline the blade in a glow when the Blade panel opens) to connect the control to the 3D part. This helps users understand what each section controls. Additionally, we ensure the **most impactful controls are easy to find**: e.g., Blade length/width are right at the top because they drastically change the silhouette, whereas a minor detail like “bevel size” on edges might be lower or even hidden under an “Advanced” toggle.

* **Avoiding Clutter:** Given up to 50 controls, even within categories it could be a lot. We can use UI tricks to avoid clutter: for instance, hide advanced options behind a toggle (“Show advanced blade options”). Only users who want to fine-tune the bevel or noise will click that, keeping the default interface simpler. Color pickers or non-slider inputs (like dropdown for material) should be visually distinct and perhaps placed separately so they don’t just appear as another slider.

* **Responsiveness:** The UI should be usable on different screen sizes. Likely this tool is desktop-focused (because 3D modeling UI is easier with a mouse), but ensuring the layout is scrollable or adaptive is good. Each slider can be a horizontal range input with a label on the left and value on the right, arranged in a single column for each category for clarity.

* **Feedback and Affordances:** As the user manipulates controls, they will see the 3D feedback. We can also provide textual feedback for certain values (e.g. display the numeric value next to slider). If a combination is unusual (using the validation mentioned earlier), a non-blocking indicator could appear near the relevant sliders (e.g. an exclamation icon with tooltip “Guard is very large compared to blade”). This keeps the user informed without stopping their creativity.

* **Polish:** We will style the UI to match the theme (perhaps a minimal dark theme so it doesn’t distract from the 3D view, or a stylized fantasy UI for fun). However, clarity is king: use readable fonts and sufficient contrast. The categories should be easily distinguishable. If using a library like dat.GUI, we might style it or switch to a more flexible UI approach because dat.GUI might not scale well to 50 controls (though it supports folders which helps). A custom UI might actually be preferable for full control over layout and styling.

* **User Workflow:** Typically, a user might load a preset, then tweak blade length, width, etc., then adjust guard and pommel. We want this workflow to feel natural, so potentially order the categories in the sequence one would “build” a sword: Blade first, then Guard, Handle, Pommel last. That way, going top-down in the UI is like assembling the sword. It’s a small UX touch that can make the process feel logical.

By organizing controls into categories, providing sensible defaults/presets, and keeping the interface clean, we ensure the large number of options remains **discoverable and manageable**. The user can focus on one aspect at a time (e.g., “I’ll perfect the blade shape, then move to the hilt”) without being lost in a sea of sliders. This structured UI, combined with the real-time 3D feedback, creates an empowering experience where novices and experts alike can craft swords ranging from historically inspired to wildly fantastical. The design balances **rich functionality with usability**, enabling deep customization without overwhelming the user from the outset.

**Sources:**

* Three.js ExtrudeGeometry example – demonstrating creating geometry from parametric shape dimensions[\[2\]](https://threejs.org/docs/api/en/geometries/ExtrudeGeometry.html#:~:text=,add%28%20mesh%20%29%3B).

* Three.js GLTFExporter usage for generating and downloading glTF/GLB files[\[4\]](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424#:~:text=const%20exporter%20%3D%20new%20GLTFExporter)[\[5\]](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424#:~:text=%2F%2F%20called%20when%20the%20gltf,result%29).

* Procedural generation principles, highlighting the huge design space of many parameters and the need for rules/constraints for invalid combos[\[7\]](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449#:~:text=Reducing%20the%20space%20of%20variations,with%20Rules).

* UX guidelines for sliders and real-time feedback (immediate visual response \<100ms) for a smooth interactive experience[\[1\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=Sliders%20are%20effective%20when%20users,the%20results%20of%20the%20change).

* Parametric design UI with validation/warning system for extreme or invalid parameter combinations[\[8\]](https://www.ideastatica.com/support-center/ux-features-in-parametric-design#:~:text=,warning%20or%20error%20icon%20displays).

---

[\[1\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=Sliders%20are%20effective%20when%20users,the%20results%20of%20the%20change) [\[9\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=Summary%3A%C2%A0%20Linked%20controls%20support%20coarse,ease%20of%20exploration%20and%20precision) [\[10\]](https://www.nngroup.com/articles/sliders-knobs/#:~:text=,precisely%20choose%20a%20specific%20value) Sliders, Knobs, and Matrices: Balancing Exploration and Precision \- NN/G

[https://www.nngroup.com/articles/sliders-knobs/](https://www.nngroup.com/articles/sliders-knobs/)

[\[2\]](https://threejs.org/docs/api/en/geometries/ExtrudeGeometry.html#:~:text=,add%28%20mesh%20%29%3B) threejs.org

[https://threejs.org/docs/api/en/geometries/ExtrudeGeometry.html](https://threejs.org/docs/api/en/geometries/ExtrudeGeometry.html)

[\[3\]](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449#:~:text=In%20the%20particular%20project%20we,the%20next%20number%20of%20options) [\[7\]](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449#:~:text=Reducing%20the%20space%20of%20variations,with%20Rules) Procedural generation of 3d objects with three.js | by Alexey Degtyarik | Medium

[https://medium.com/@LEM\_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449)

[\[4\]](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424#:~:text=const%20exporter%20%3D%20new%20GLTFExporter) [\[5\]](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424#:~:text=%2F%2F%20called%20when%20the%20gltf,result%29) Downloading a glb file with GLTFExporter \- Questions \- three.js forum

[https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424](https://discourse.threejs.org/t/downloading-a-glb-file-with-gltfexporter/45424)

[\[6\]](https://threejs.org/docs/examples/en/exporters/GLTFExporter.html#:~:text=,options%20%29%3B) threejs.org

[https://threejs.org/docs/examples/en/exporters/GLTFExporter.html](https://threejs.org/docs/examples/en/exporters/GLTFExporter.html)

[\[8\]](https://www.ideastatica.com/support-center/ux-features-in-parametric-design#:~:text=,warning%20or%20error%20icon%20displays) UX Improvements of Parametric design | IDEA StatiCa

[https://www.ideastatica.com/support-center/ux-features-in-parametric-design](https://www.ideastatica.com/support-center/ux-features-in-parametric-design)