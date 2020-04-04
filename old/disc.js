;

class Disc {
	constructor() {
		this.normal_display_vrts = [];
	}

	LERP(a, b, t) {
		return a + (b - a) * t;
	}

	PushVertex(a, v) {
		// This construction avoids overhead of a loop.
		switch (v.length) {
			case 4:
				v[3] = (Math.abs(v[3]) < Number.EPSILON) ? 0 : v[3];
			case 3:
				v[2] = (Math.abs(v[2]) < Number.EPSILON) ? 0 : v[2];
			case 2:
				v[1] = (Math.abs(v[1]) < Number.EPSILON) ? 0 : v[1];
				v[0] = (Math.abs(v[0]) < Number.EPSILON) ? 0 : v[0];
		}
		switch (v.length) {
			case 2:
				a.push(v[0], v[1]);
				break;

			case 3:
				a.push(v[0], v[1], v[2]);
				break;

			case 4:
				a.push(v[0], v[1], v[2], v[3]);
				break;
		}
	}

	Initialize(front_radius, rear_radius, front_center, rear_center, start_theta, end_theta, slices, stacks) {
		this.front_radius = front_radius || 0.5;
		this.rear_radius = rear_radius || 0;
		this.front_center = front_center || [0, 0, 0]
		this.rear_center = rear_center || [0, 0, 0]
		this.start_theta = start_theta || 0;
		this.end_theta = end_theta || 360;
		this.slices = slices || 16;
		this.stacks = stacks || 2;

		if (this.slices < 3)
			throw new Error('Disc slices must be 3 or greater');
		
		this.triangle_vrts = [];
		this.texture_coords = [];
		this.normal_vrts = [];
		this.indicies = [];
		this.line_seg_indicies = [];
		this.z_axis = [0, 0, 1];
		this.partial_sweep = (start_theta != ((end_theta + 360) % 360));
		this.real_slices = this.slices + (this.partial_sweep ? 1 : 0);
		this.sweep = end_theta - start_theta;

		this.CreateBuffers();
		this.MakeGeometry();
		this.MakeNormals();
		this.MakeInternalShader();
		this.BindBuffers();
	}

	BindBuffers() {
		// This VAO is used when drawing outlines
		gl.bindVertexArray(this.line_seg_vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.triangle_vrts_buffer);
		gl.vertexAttribPointer(this.solid_shader.a_vertex_coordinates, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.solid_shader.a_vertex_coordinates);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.triangle_vrts), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.line_seg_indicies_buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(this.line_seg_indicies), gl.STATIC_DRAW);
		gl.bindVertexArray(null);

		// This VAO is usedd when bisualizing normals - note scaling non-uniformly is not handled.
		gl.bindVertexArray(this.normal_vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normal_display_vrts_buffer);
		gl.vertexAttribPointer(this.solid_shader.a_vertex_coordinates, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(this.solid_shader.a_vertex_coordinates);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normal_display_vrts), gl.STATIC_DRAW);
		gl.bindVertexArray(null);

		let e = gl.getError();
		if (e != gl.NO_ERROR)
			throw new Error('gl.getError() returns: ' + e.toString());
	}

	DrawNormals(prj, mv, c) {
		if (prj == undefined)
			throw new Error('Projection matrix must be supplied');
		if (mv == undefined)
			throw new Error('Modelview matrix must be supplied');

		c = c || [ 1, 1, 1, 1 ]
		gl.useProgram(this.solid_shader.program);
		gl.uniformMatrix4fv(this.solid_shader.u_mv, false, mv);
		gl.uniformMatrix4fv(this.solid_shader.u_pj, false, prj);
		gl.uniform4fv(this.solid_shader.u_color, c);
		gl.bindVertexArray(this.normal_vao);
		gl.drawArrays(gl.LINES, 0, this.normal_display_vrts.length / 3);
		gl.bindVertexArray(null);
		gl.useProgram(null);

		let e = gl.getError();
		if (e != gl.NO_ERROR)
			throw new Error('gl.getError() returns: ' + e.toString());
	}

	DrawOutline(prj, mv, c) {
		if (prj == undefined)
			throw new Error('Projection matrix must be supplied');
		if (mv == undefined)
			throw new Error('Modelview matrix must be supplied');

		c = c || [ 1, 1, 1, 1 ]
		gl.useProgram(this.solid_shader.program);
		gl.uniformMatrix4fv(this.solid_shader.u_mv, false, mv);
		gl.uniformMatrix4fv(this.solid_shader.u_pj, false, prj);
		gl.uniform4fv(this.solid_shader.u_color, c);
		gl.bindVertexArray(this.line_seg_vao);
		gl.drawElements(gl.LINES, this.line_seg_indicies.length, gl.UNSIGNED_SHORT, 0);
		gl.bindVertexArray(null);
		gl.useProgram(null);
		let e = gl.getError();
		if (e != gl.NO_ERROR)
			throw new Error('gl.getError() returns: ' + e.toString());
	}

	MakeGeometry() {
		let theta_inc = this.sweep / this.slices;
		let rear_to_front_inc = 1.0 / (this.stacks);
		let rear_to_front_t = 0;
		let current_center = vec3.create();
		let p = vec3.create();
		let start_theta = Radians(this.start_theta);
		let end_theta = Radians(this.end_theta);
		theta_inc = Radians(theta_inc);

		for (let stk = 0; stk < this.stacks + 1; stk++)
		{
			vec3.lerp(current_center, this.rear_center, this.front_center, rear_to_front_t);

			let u = stk / this.stacks;
			let current_radius = [this.LERP(this.rear_radius, this.front_radius, rear_to_front_t), 0, 0];
			let rot_matrix = mat4.create();

			mat4.rotate(rot_matrix, rot_matrix, this.start_theta, this.z_axis);

			for (var slc = 0; slc < this.real_slices; slc++)
			{
				var v = slc / this.slices;
				//console.log(slc + ' ' + v);
				vec3.transformMat4(p, current_radius, rot_matrix);
				vec3.add(p, p, current_center);
				this.PushVertex(this.triangle_vrts, p);
				this.PushVertex(this.texture_coords, [u, v]);
				mat4.rotate(rot_matrix, rot_matrix, theta_inc, this.z_axis);
			}
			rear_to_front_t += rear_to_front_inc;
		}

		for (let stk = 0; stk < this.stacks; stk++)
		{
			for (let slc = 0; slc < this.slices; slc++)
			{
				this.indicies.push(stk * this.real_slices + slc);
				this.indicies.push(stk * this.real_slices + (slc + 1) % this.real_slices);
				this.indicies.push((stk + 1) * this.real_slices + slc);
				this.indicies.push(stk * this.real_slices + (slc + 1) % this.real_slices);
				this.indicies.push((stk + 1) * this.real_slices + (slc + 1) % this.real_slices);
				this.indicies.push((stk + 1) * this.real_slices + slc);
			}
		}

		this.triangle_adjacency = Array(this.triangle_vrts.length / 3)
		for (let i = 0; i < this.triangle_vrts.length / 3; i++)
			this.triangle_adjacency[i] = [];
		
		for (let i = 0; i < this.indicies.length / 3; i++)
		{
			// i is a triangle index. index_vn are indexies of vertexes within triangles.
			let index_v0 = this.indicies[i * 3 + 0];
			let index_v1 = this.indicies[i * 3 + 1];
			let index_v2 = this.indicies[i * 3 + 2];

			// Make the line segments for drawing outlines.
			this.line_seg_indicies.push(index_v0);
			this.line_seg_indicies.push(index_v1);
			this.line_seg_indicies.push(index_v1);
			this.line_seg_indicies.push(index_v2);
			this.line_seg_indicies.push(index_v2);
			this.line_seg_indicies.push(index_v0);

			// Make the adjacency data structure.
			this.triangle_adjacency[index_v0].push(i);
			this.triangle_adjacency[index_v1].push(i);
			this.triangle_adjacency[index_v2].push(i);
		}
	}

	MakeNormals() {
		var v0v1 = vec3.create();
		var v0v2 = vec3.create();
		var tri_norm = vec3.create();
		var v0 = vec3.create();

		// triangle_adjency is an array of arrays. There is one top level for each
		// vertex. The second level is an array of the triangle numbers that impact
		// the given vertex.  
		for (var vertex_index = 0; vertex_index < this.triangle_adjacency.length; vertex_index++)
		{
			var neighbor_list = this.triangle_adjacency[vertex_index];
			var normal = vec3.create();
			var divisor = neighbor_list.length;
			//console.log('Vertex index: ' + vertex_index + ' Neighbors: ' + neighbor_list);

			if (divisor == 0)
				throw new Error('Neighbor list has 0 entries. This cannot be.');

			var limit = divisor;
			if (limit == 3)
				divisor = 2;

			for (var i = 0; i < limit; i++)
			{
				if (limit == 3 && i == 1)
					i++;

				var triangle_index = neighbor_list[i] * 3;
				var index_v0 = this.indicies[triangle_index + 0] * 3;
				var index_v1 = this.indicies[triangle_index + 1] * 3;
				var index_v2 = this.indicies[triangle_index + 2] * 3;
				//console.log('tri_index: ' + triangle_index / 3 + ' vertices: ' + index_v0 + ' ' + index_v1 + ' ' + index_v2);
				v0 = this.triangle_vrts.slice(index_v0, index_v0 + 3);
				var v1 = this.triangle_vrts.slice(index_v1, index_v1 + 3);
				var v2 = this.triangle_vrts.slice(index_v2, index_v2 + 3);
				vec3.sub(v0v1, v0, v1);
				vec3.sub(v0v2, v0, v2);
				//vec3.normalize(v0v1, v0v1);
				//vec3.normalize(v0v2, v0v2);
				vec3.cross(tri_norm, v0v2, v0v1);
				vec3.normalize(tri_norm, tri_norm);
				//console.log(tri_norm);
				vec3.add(normal, normal, tri_norm);
			}

			vec3.scale(normal, normal, divisor);
			vec3.normalize(normal, normal);
			this.PushVertex(this.normal_vrts, normal);

			v0 = this.triangle_vrts.slice(vertex_index * 3 + 0, vertex_index * 3 + 3);
			this.PushVertex(this.normal_display_vrts, v0);
			vec3.scale(normal, normal, 0.1);
			vec3.add(normal, v0, normal);
			this.PushVertex(this.normal_display_vrts, normal);
		}
	}

	CreateBuffers() {
		/*
		triangle_vao		used in main drawing
		line_seg_vao		used to draw triangle outlines
		normal_vao			used to draw display normals 
		*/
		this.triangle_vao = gl.createVertexArray();
		this.line_seg_vao = gl.createVertexArray();
		this.normal_vao = gl.createVertexArray();

		this.triangle_vrts_buffer = gl.createBuffer();
		this.normal_vrts_buffer = gl.createBuffer();
		this.indicies_buffer = gl.createBuffer();
		this.texture_coords_buffer = gl.createBuffer();
		this.line_seg_indicies_buffer = gl.createBuffer();
		this.normal_display_vrts_buffer = gl.createBuffer();

		this.line_seg_vrts_buffer = null;

		/*
		this.ls_indicies_buffer = gl.createBuffer();
		*/
	}

	/*	MakeInternalShader() - Buillding in a solid color shader makes sense because
		in addition to be required (to outline triangles and render normals) it can
		aid in development. That is, before everything required for lighting is 
		written and debugged, the solid outlines can be used to ensure geometry is
		being put together correctly.
	*/
	MakeInternalShader() {
		let vertex_shader_source = `#version 300 es
			uniform mat4 u_mv;
			uniform mat4 u_pj;
			in vec3 a_vertex_coordinates;
			out float d;

			void main(void)
			{ 
				gl_Position = u_pj * u_mv * vec4(a_vertex_coordinates, 1.0);
				d = -a_vertex_coordinates.x;
			}
		`;
		let fragment_shader_source = `#version 300 es
			precision mediump float;
			uniform vec4 u_color;
			in float d;
			out vec4 frag_color;
			void main(void)
			{
				frag_color = u_color * d;
			}
		`;

		let vertShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertShader, vertex_shader_source);
		gl.compileShader(vertShader);
		let success = gl.getShaderParameter(vertShader, gl.COMPILE_STATUS);
		if (!success)
			throw "Disc - Could not compile vertex shader:" + gl.getShaderInfoLog(vertShader);

		let fragShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragShader, fragment_shader_source);
		gl.compileShader(fragShader);
		success = gl.getShaderParameter(fragShader, gl.COMPILE_STATUS);
		if (!success)
			throw "Disc - Could not compile fragment shader:" + gl.getShaderInfoLog(fragShader);

		this.solid_shader = {};
		this.solid_shader.program = gl.createProgram();
		gl.attachShader(this.solid_shader.program , vertShader); 
		gl.attachShader(this.solid_shader.program , fragShader);
		gl.linkProgram(this.solid_shader.program );
		success = gl.getProgramParameter(this.solid_shader.program, gl.LINK_STATUS);
		if (!success)
			throw ("Shader program filed to link:" + gl.getProgramInfoLog(this.solid_shader.program));

		gl.useProgram(this.solid_shader.program);
		this.solid_shader.a_vertex_coordinates = gl.getAttribLocation(this.solid_shader.program, "a_vertex_coordinates");
		this.solid_shader.u_color = gl.getUniformLocation(this.solid_shader.program, "u_color");
		this.solid_shader.u_mv = gl.getUniformLocation(this.solid_shader.program, "u_mv");
		this.solid_shader.u_pj = gl.getUniformLocation(this.solid_shader.program, "u_pj");
		gl.useProgram(null);

		console.log('Vertex attribute (should be 0): ' + this.solid_shader.a_vertex_coordinates);
		console.log('Color uniform handle: ' + this.solid_shader.u_color);
		console.log('MV Matrix handle: ' + this.solid_shader.u_mv);
		console.log('PJ Matrix handle: ' + this.solid_shader.u_pj);
	}
}