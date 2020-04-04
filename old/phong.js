
class PhongShader
{
	constructor()
	{
		this.vertex_src = `#version 300 es
precision mediump float;

in vec3 a_vertices;
in vec3 a_normals;

uniform mat4 u_modelview_matrix;
uniform mat3 u_normal_matrix;
uniform mat4 u_projection_matrix;

out vec3 v_eyeCoords;
out vec3 v_normal;
out vec2 v_tcoords;

void main()
{
	v_normal = normalize(u_normal_matrix * a_normals);
	v_eyeCoords = vec3(u_modelview_matrix * vec4(a_vertices,1.0) );
	gl_Position = u_projection_matrix * vec4(v_eyeCoords,1.0);
}
`;

	this.fragment_src = `#version 300 es
precision mediump float;

in vec3 v_eyeCoords;
in vec3 v_normal;

out vec4 frag_color;

uniform float u_shininess;
uniform vec4 u_light_position;
uniform vec3 u_color;

const float ONE_OVER_PI = 1.0 / 3.14159265;

vec4 ads()
{
	vec3 n = normalize(v_normal);
	if (gl_FrontFacing) {
		return vec4(0, 0, 0, 1.0);
	}

	vec3 s = normalize(vec3(u_light_position) - v_eyeCoords);
	vec3 v = normalize(-v_eyeCoords);
	vec3 r = reflect(-s, n);
	vec3 diffuse = max(dot(s, n), 0.0) * u_color;
	vec3 specular = pow(max(dot(r, v), 0.0), u_shininess) * vec3(1, 1, 1);

	return vec4(diffuse + specular, 1.0);
}

void main()
{
	frag_color = ads();
}
`;

		this.CreateShader();
		this.InitializeShader();
	}

	/**
	* Initialize a shader: define all attribute and uniform handles.
	* NOTE - NOTE - NOTE - All shaders managed by this class follow a "standardized" set of
	* stock uniforms and attributes. Some shaders may not make use of "a_colors" for example
	* but all will attempt to define it. The later code used to call the shader will ensure
	* that attributes and uniforms that are not used will not be configured for use. Such
	* use would cause a runtime error.
	* @param {none} no parameters
	* @return {none} no return value
	*/
	InitializeShader()
	{
		gl.useProgram(this.program);
		this.a_vertices = gl.getAttribLocation(this.program, "a_vertices");
		this.a_normals = gl.getAttribLocation(this.program, "a_normals");
		this.u_color_handle = gl.getUniformLocation(this.program, "u_color");
		this.u_normal_matrix_handle = gl.getUniformLocation(this.program, "u_normal_matrix");
		this.u_light_position_handle = gl.getUniformLocation(this.program, "u_light_position");
		this.u_modelview_matrix_handle = gl.getUniformLocation(this.program, "u_modelview_matrix");
		this.u_projection_matrix_handle = gl.getUniformLocation(this.program, "u_projection_matrix");
		this.u_shininess_handle = gl.getUniformLocation(this.program, "u_shininess");
		gl.useProgram(null);
	}

	/**
	* Enables "this" shader program.
	* @param {none} no parameters
	* @return {none} no return value
	*/
	UseProgram() {
		gl.useProgram(this.program);
	}

	EndProgram() {
		gl.useProgram(null);
	}

	SetStandardUniforms(modelview_matrix, projection_matrix, normal_matrix, light_position) {
		gl.uniformMatrix4fv(this.u_modelview_matrix_handle, false, modelview_matrix);	
		gl.uniformMatrix4fv(this.u_projection_matrix_handle, false, projection_matrix);	
		gl.uniformMatrix3fv(this.u_normal_matrix_handle, false, normal_matrix);
		gl.uniform4fv(this.u_light_position_handle, light_position);
	}

	CreateShader() {
		let success;
		let vrtx = this.vertex_src;
		let frag = this.fragment_src;
		let vertShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertShader, vrtx);
		gl.compileShader(vertShader);
		success = gl.getShaderParameter(vertShader, gl.COMPILE_STATUS);
		if (!success)
			throw "Could not compile vertex shader:" + gl.getShaderInfoLog(vertShader);

		var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragShader, frag);
		gl.compileShader(fragShader);
		success = gl.getShaderParameter(fragShader, gl.COMPILE_STATUS);
		if (!success)
			throw "Could not compile fragment shader:" + gl.getShaderInfoLog(fragShader);

		this.program = gl.createProgram();
		gl.attachShader(this.program, vertShader); 
		gl.attachShader(this.program, fragShader);
		gl.linkProgram(this.program);
		success = gl.getProgramParameter(this.program, gl.LINK_STATUS);
		if (!success)
			throw ("Shader program filed to link:" + gl.getProgramInfoLog (this.program));
	}
}
