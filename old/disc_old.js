;

var DC_FLAGS = {
	COMPUTE_WRONG_NORMALS: 0x00,
	COMPUTE_FLAT_NORMALS: 0x01,
	COMPUTE_SMOOTH_NORMALS: 0x02,
	NORMAL_MASK: 0x03
}

class DC
{
	constructor()
	{
		this.triangle_vrts = [];
		this.texture_coords = [];
		this.normal_display_vrts = [];
		this.normal_vrts = [];
		this.indicies = [];
		this.ls_indicies = [];

		this.texture_coords_buffer = null;
		this.triangle_vrts_buffer = null;
		this.line_segment_vrts_buffer = null;
		this.normal_display_vrts_buffer = null;
		this.normal_vrts_buffer = null;
		this.indicies_buffer = null;
		this.ls_indicies_buffer = null;
	}

	Initialize(fr, br, fc, bc, beginning_theta, ending_theta, slices, stacks, flags)
	{
		this.slices = slices;
		this.stacks = stacks;

		var normal_style = 0;
		if (flags != undefined)
			normal_style = flags & DC_FLAGS.NORMAL_MASK;
		this.CreateBuffers();
		this.MakeVerticiesAndTriangles(fr, br, fc, bc, beginning_theta, ending_theta, slices, stacks);
		this.MakeNormals();
		this.BindBuffers();
	}

	MakeNormals()
	{
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
			PushVertex(this.normal_vrts, normal);

			v0 = this.triangle_vrts.slice(vertex_index * 3 + 0, vertex_index * 3 + 3);
			PushVertex(this.normal_display_vrts, v0);
			vec3.scale(normal, normal, 0.1);
			vec3.add(normal, v0, normal);
			PushVertex(this.normal_display_vrts, normal);
		}
	}

	MakeVerticiesAndTriangles(fr, br, fc, bc, beginning_theta, ending_theta, slices, stacks)
	{
		if (slices < 2)
			throw new Error('Disc slices must be more than 2');

		if (beginning_theta == undefined)
			beginning_theta = 0;

		if (ending_theta == undefined)
			ending_theta = 360;

		var z_axis = [0, 0, 1];
		var partial_sweep = (beginning_theta != ((ending_theta + 360) % 360));
		var real_slices = slices + (partial_sweep ? 1 : 0);
		this.sweep = ending_theta - beginning_theta;
		var incremental_theta = this.sweep / slices;
		var incremental_back_to_front = 1.0 / (stacks);
		var back_to_front = 0;
		var center = vec3.create();
		var p = vec3.create();

		beginning_theta = Radians(beginning_theta);
		ending_theta = Radians(ending_theta);
		incremental_theta = Radians(incremental_theta);

		for (var stk = 0; stk < stacks + 1; stk++)
		{
			var u = stk / stacks;
			var x = [LERP(br, fr, back_to_front), 0, 0];
			vec3.lerp(center, bc, fc, back_to_front);
			var r = mat4.create();

			mat4.rotate(r, r, beginning_theta, z_axis);
			for (var slc = 0; slc < real_slices; slc++)
			{
				var v = slc / slices;
				console.log(slc + ' ' + v);
				vec3.transformMat4(p, x, r);
				vec3.add(p, p, center);
				PushVertex(this.triangle_vrts, p);
				PushVertex(this.texture_coords, [u, v]);
				mat4.rotate(r, r, incremental_theta, z_axis);
			}
			back_to_front += incremental_back_to_front;
		}

		for (var stk = 0; stk < stacks; stk++)
		{
			for (var slc = 0; slc < slices; slc++)
			{
				this.indicies.push(stk * real_slices + slc);
				this.indicies.push(stk * real_slices + (slc + 1) % real_slices);
				this.indicies.push((stk + 1) * real_slices + slc);
				this.indicies.push(stk * real_slices + (slc + 1) % real_slices);
				this.indicies.push((stk + 1) * real_slices + (slc + 1) % real_slices);
				this.indicies.push((stk + 1) * real_slices + slc);
			}
		}
				
		this.triangle_adjacency = Array(this.triangle_vrts.length / 3)
		for (var i = 0; i < this.triangle_vrts.length / 3; i++)
			this.triangle_adjacency[i] = [];
		
		for (var i = 0; i < this.indicies.length / 3; i++)
		{
			// i is a triangle index. index_vn are indexies of vertexes withing triangles.
			var index_v0 = this.indicies[i * 3 + 0];
			var index_v1 = this.indicies[i * 3 + 1];
			var index_v2 = this.indicies[i * 3 + 2];

			// Make the line segments for drawing outlines.
			this.ls_indicies.push(index_v0);
			this.ls_indicies.push(index_v1);
			this.ls_indicies.push(index_v1);
			this.ls_indicies.push(index_v2);
			this.ls_indicies.push(index_v2);
			this.ls_indicies.push(index_v0);

			// Make the adjacency data structure.
			this.triangle_adjacency[index_v0].push(i);
			this.triangle_adjacency[index_v1].push(i);
			this.triangle_adjacency[index_v2].push(i);
		}

		
		/*
		PushVertex(this.triangle_vrts, [0, 1, 0]);
		PushVertex(this.triangle_vrts, [1, -1, 0]);
		PushVertex(this.triangle_vrts, [-1, -1, 0]);
		PushVertex(this.normal_vrts, [0, 0.5, 0.5]);
		PushVertex(this.normal_vrts, [0.5, -0.5, 0.5]);
		PushVertex(this.normal_vrts, [-0.5, -0.5, 0.5]);
		PushVertex(this.indicies, [0, 1, 2]);
		*/


	}

	CreateBuffers()
	{
		this.triangle_vrts_buffer = gl.createBuffer();
		this.texture_coords_buffer = gl.createBuffer();
		this.normal_display_vrts_buffer = gl.createBuffer();
		this.normal_vrts_buffer = gl.createBuffer();
		this.indicies_buffer = gl.createBuffer();
		this.ls_indicies_buffer = gl.createBuffer();
	}

	BindBuffers()
	{
		gl.bindBuffer(gl.ARRAY_BUFFER, this.triangle_vrts_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.triangle_vrts), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.texture_coords_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.texture_coords), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normal_display_vrts_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normal_display_vrts), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normal_vrts_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normal_vrts), gl.STATIC_DRAW);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicies_buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(this.indicies), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		this.indicies_buffer.itemSize = 1;
		this.indicies_buffer.numItems = this.indicies.length;		

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ls_indicies_buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(this.ls_indicies), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		this.ls_indicies_buffer.itemSize = 1;
		this.ls_indicies_buffer.numItems = this.ls_indicies.length;
	}
	
	Draw(face_shader, line_shader, mv, prj, nm, lp, draw_normals, draw_wireframe, show_triangles, m)
	{
		if (draw_wireframe == false)
		{
			face_shader.UseProgram();
			face_shader.SetStandardUniforms(mv, prj, nm, lp, m);
			face_shader.SetStandardAttributes(this.triangle_vrts_buffer, this.normal_vrts_buffer, null, this.texture_coords_buffer);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indicies_buffer);
			gl.drawElements(gl.TRIANGLES, this.indicies.length, gl.UNSIGNED_SHORT, 0);
 			face_shader.DisableStandardAttributes();
			face_shader.EndProgram();
		}

		if (draw_normals)
		{
			line_shader.UseProgram();
			line_shader.SetStandardUniforms(mv, prj, null, lp, m);
			line_shader.SetStandardAttributes(this.normal_display_vrts_buffer, null, null);
			gl.drawArrays(gl.LINES, 0, this.normal_display_vrts.length / 3);
			line_shader.DisableStandardAttributes();
			line_shader.EndProgram();
		}

		if (draw_wireframe || show_triangles)
		{
			line_shader.UseProgram();
			line_shader.SetStandardUniforms(mv, prj, null, lp, m);
			line_shader.SetStandardAttributes(this.triangle_vrts_buffer, null, null);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ls_indicies_buffer);
			gl.drawElements(gl.LINES, this.ls_indicies.length, gl.UNSIGNED_SHORT, 0);
			line_shader.DisableStandardAttributes();
			line_shader.EndProgram();
		}

	}
}