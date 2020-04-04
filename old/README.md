# WebGL Model Primitives

## Disc / Cone / Cylinder

The Disc / Cone / Cylinder primitive flexibly builds a disc (or cone or cylinder) with:

* starting and ending angle (in degrees for conceptual ease)
* outer and inner radius
* outer and inner center coordinates
* slices and stacks
* precomputed normals for smooth shading (other modes possible)
* geometry for showing wireframe and display of normals

### Use of center coordinate

The primitive is initialized with two center coordinates.

If they are the same point, the result is a disc.

If they differ, the result is a cone or cylinder.

### Use of inner and outer radius

If the inner radius is 0, the result is a solid disc or complete cone.

If the inner radius is not 0, the result is a ring or truncated cone.

### Making a cylinder

If the center points are displaced in Z and the front and back radii are the same, you get a cylinder.

### Use of starting and ending angle

If the starting and ending angle does not span 360 degrees, a partial disc (e.g. the letter "C" if inner radius is not 0) or a partial cone is made.

### Slices

Slices are the number of divisions around the periphery. A larger number means a more precise approximation of a circle.

### Stacks

Stacks are the number of divisions within the primitive in the direction of a radius. This is typically 1 but a larger number may be appropriate if an uneven surface will be made (later).