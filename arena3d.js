(() => {
  const canvas = document.getElementById('arenaCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'low-power' });
  if (!gl) return;

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uModel;
    uniform mat4 uViewProjection;
    uniform vec3 uColor;
    varying vec3 vColor;
    varying float vLight;
    void main() {
      vec3 normal = normalize(mat3(uModel) * aNormal);
      vec3 light = normalize(vec3(-0.45, 0.9, 0.55));
      vLight = 0.38 + max(dot(normal, light), 0.0) * 0.72;
      vColor = uColor;
      gl_Position = uViewProjection * uModel * vec4(aPosition, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec3 vColor;
    varying float vLight;
    void main() {
      gl_FragColor = vec4(vColor * vLight, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn('3D arena could not initialize:', error);
    return;
  }

  gl.useProgram(program);
  const locations = {
    position: gl.getAttribLocation(program, 'aPosition'),
    normal: gl.getAttribLocation(program, 'aNormal'),
    model: gl.getUniformLocation(program, 'uModel'),
    viewProjection: gl.getUniformLocation(program, 'uViewProjection'),
    color: gl.getUniformLocation(program, 'uColor'),
  };

  function meshData(vertices, indices) {
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    return { vertexBuffer, indexBuffer, count: indices.length };
  }

  function sphereData(rows = 14, columns = 18) {
    const vertices = [];
    const indices = [];
    for (let row = 0; row <= rows; row += 1) {
      const v = row / rows;
      const phi = v * Math.PI;
      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns;
        const theta = u * Math.PI * 2;
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        vertices.push(x, y, z, x, y, z);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    return meshData(vertices, indices);
  }

  function cylinderData(segments = 12) {
    const vertices = [];
    const indices = [];
    for (let end = 0; end < 2; end += 1) {
      const y = end === 0 ? -0.5 : 0.5;
      for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle);
        const z = Math.sin(angle);
        vertices.push(x, y, z, x, 0, z);
      }
    }
    for (let i = 0; i < segments; i += 1) {
      const a = i;
      const b = i + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return meshData(vertices, indices);
  }

  const sphere = sphereData();
  const cylinder = cylinderData();
  const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  function multiply(a, b) {
    const out = new Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }

  function translate(x, y, z) {
    const out = identity();
    out[12] = x; out[13] = y; out[14] = z;
    return out;
  }

  function scale(x, y, z) {
    const out = identity();
    out[0] = x; out[5] = y; out[10] = z;
    return out;
  }

  function rotateY(angle) {
    const out = identity();
    out[0] = Math.cos(angle); out[2] = -Math.sin(angle);
    out[8] = Math.sin(angle); out[10] = Math.cos(angle);
    return out;
  }

  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }

  function lookAt(eye, center, up) {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let length = Math.hypot(zx, zy, zz) || 1;
    zx /= length; zy /= length; zz /= length;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    length = Math.hypot(xx, xy, xz) || 1;
    xx /= length; xy /= length; xz /= length;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1];
  }

  const mat = (position, size, rotation = 0) => multiply(multiply(translate(...position), rotateY(rotation)), scale(...size));
  const palette = {
    player: { body: [0.96, 0.27, 0.59], trim: [1, 0.68, 0.32], hair: [0.29, 0.12, 0.36], skin: [1, 0.72, 0.64], shorts: [0.24, 0.17, 0.35] },
    enemy: { body: [0.16, 0.74, 0.89], trim: [0.96, 0.36, 0.27], hair: [0.12, 0.18, 0.36], skin: [0.88, 0.66, 0.61], shorts: [0.14, 0.2, 0.34] },
  };
  const motion = { player: 'idle', enemy: 'idle', playerAt: 0, enemyAt: 0, playerName: 'Aster Nova', enemyName: 'Rival' };

  function draw(mesh, model, color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(locations.normal);
    gl.vertexAttribPointer(locations.normal, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.uniformMatrix4fv(locations.model, false, new Float32Array(model));
    gl.uniform3fv(locations.color, color);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function sphereAt(position, size, color, rotation = 0) {
    draw(sphere, mat(position, size, rotation), color);
  }

  function cylinderAt(position, size, color, rotation = 0) {
    draw(cylinder, mat(position, size, rotation), color);
  }

  function drawRunner(x, facing, colors, side, time) {
    const active = motion[side] !== 'idle' && time - motion[`${side}At`] < 520;
    const phase = time / 230 + (side === 'enemy' ? 1.8 : 0);
    const bounce = active ? Math.abs(Math.sin(phase * 2)) * 0.18 : Math.sin(phase) * 0.045;
    const stride = active ? Math.sin(phase * 2) * 0.42 : Math.sin(phase) * 0.055;
    const turn = facing < 0 ? Math.PI : 0;
    const cx = x + (active && motion[side] === 'dash' ? Math.sin(phase * 2) * 0.13 : 0);
    const y = bounce;

    // Soft shadow and lane marker.
    sphereAt([cx, 0.035, 0.12], [0.83, 0.045, 0.48], [0.09, 0.09, 0.18]);
    cylinderAt([x, 0.015, 0.14], [0.86, 0.035, 0.86], colors.trim, 0);
    // Tail, ears, hair cap, face and eyes.
    sphereAt([cx - facing * 0.48, 1.55 + y, -0.02], [0.42, 0.12, 0.13], colors.hair, -0.45 * facing + Math.sin(phase) * 0.14);
    sphereAt([cx - 0.14, 2.45 + y, 0], [0.14, 0.42, 0.14], colors.hair, -0.22);
    sphereAt([cx + 0.14, 2.45 + y, 0], [0.14, 0.42, 0.14], colors.hair, 0.22);
    sphereAt([cx, 2.02 + y, 0], [0.48, 0.52, 0.4], colors.skin, turn);
    sphereAt([cx, 2.29 + y, -0.005], [0.48, 0.28, 0.4], colors.hair, turn);
    sphereAt([cx + facing * 0.12, 2.02 + y, 0.352], [0.055, 0.085, 0.038], [0.16, 0.1, 0.22]);
    sphereAt([cx + facing * 0.29, 1.9 + y, 0.32], [0.11, 0.055, 0.045], colors.trim);
    // Jersey, waist and shorts.
    sphereAt([cx, 1.24 + y, 0], [0.42, 0.62, 0.32], colors.body);
    sphereAt([cx + facing * 0.04, 1.43 + y, 0.29], [0.13, 0.21, 0.055], colors.trim);
    sphereAt([cx, 0.83 + y, 0], [0.38, 0.2, 0.3], colors.shorts);
    // Arm swing and running legs.
    const armSwing = active ? stride : Math.sin(phase) * 0.12;
    sphereAt([cx - 0.49, 1.32 + y, 0.02], [0.16, 0.43, 0.17], colors.skin, armSwing - 0.3);
    sphereAt([cx + 0.49, 1.32 + y, 0.02], [0.16, 0.43, 0.17], colors.skin, -armSwing + 0.3);
    sphereAt([cx - 0.2, 0.48 + y, 0], [0.18, 0.48, 0.2], colors.skin, stride);
    sphereAt([cx + 0.2, 0.48 + y, 0], [0.18, 0.48, 0.2], colors.skin, -stride);
    sphereAt([cx - 0.2 - Math.sin(stride) * 0.15, 0.08 + y, 0.15], [0.3, 0.12, 0.38], colors.trim, stride);
    sphereAt([cx + 0.2 + Math.sin(stride) * 0.15, 0.08 + y, 0.15], [0.3, 0.12, 0.38], colors.trim, -stride);
  }

  function drawStadium(time) {
    // Infield and oval running lanes.
    sphereAt([0, -0.2, -0.8], [8, 0.28, 4], [0.12, 0.16, 0.27]);
    sphereAt([0, -0.035, -0.8], [6.8, 0.07, 3.2], [0.18, 0.42, 0.48]);
    sphereAt([0, 0.01, -0.8], [5.1, 0.035, 2.25], [0.2, 0.52, 0.53]);
    // Infield center and floating luminous stadium rails.
    sphereAt([0, 0.045, -0.9], [2.4, 0.045, 0.98], [0.28, 0.25, 0.4]);
    for (let i = 0; i < 10; i += 1) {
      const x = -6.2 + i * 1.38;
      const height = 0.5 + (Math.sin(i * 1.7) + 1) * 0.2;
      cylinderAt([x, height, -3.1], [0.11, height * 2, 0.11], i % 2 ? [0.34, 0.19, 0.48] : [0.12, 0.52, 0.66]);
      sphereAt([x, height * 2 + 0.04, -3.1], [0.12, 0.12, 0.12], i % 2 ? [0.97, 0.36, 0.64] : [0.28, 0.83, 1]);
    }
    for (let i = 0; i < 7; i += 1) {
      const x = -5.7 + i * 1.9;
      sphereAt([x, 2.5 + Math.sin(time / 900 + i) * 0.06, -4.1], [0.12, 0.12, 0.12], i % 2 ? [0.98, 0.39, 0.66] : [0.3, 0.78, 1]);
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function frame(time) {
    resize();
    const width = canvas.width, height = canvas.height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.055, 0.045, 0.11, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    const projection = perspective(Math.PI / 3.2, width / height, 0.1, 45);
    const view = lookAt([0, 4.35, 10.5], [0, 1.12, -0.65], [0, 1, 0]);
    gl.uniformMatrix4fv(locations.viewProjection, false, new Float32Array(multiply(projection, view)));
    drawStadium(time);
    drawRunner(-2.05, 1, palette.player, 'player', time);
    drawRunner(2.05, -1, palette.enemy, 'enemy', time);
    requestAnimationFrame(frame);
  }

  window.arena3D = {
    setNames(player, enemy) {
      motion.playerName = player;
      motion.enemyName = enemy;
    },
    act(side, action) {
      motion[side] = action;
      motion[`${side}At`] = performance.now();
    },
  };
  canvas.closest('.arena').classList.add('webgl-ready');
  requestAnimationFrame(frame);
})();
