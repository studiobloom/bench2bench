class GPUBenchmark {
  constructor() {
    this.setup();
  }

  setup() {
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1024;
      this.canvas.height = 1024;
      this.gl = this.canvas.getContext('webgl2');
      
      if (!this.gl) {
        throw new Error('WebGL2 not supported');
      }

      // Test if we can actually create a program
      const testProgram = this.gl.createProgram();
      if (!testProgram) {
        throw new Error('Unable to create WebGL program');
      }
      this.gl.deleteProgram(testProgram);

      this.isRunning = false;
      this.program = null;
      this.buffer = null;
    } catch (error) {
      console.error('GPU Benchmark setup failed:', error);
      throw error;
    }
  }

  cleanup() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.buffer) {
      this.gl.deleteBuffer(this.buffer);
      this.buffer = null;
    }
    this.isRunning = false;
  }

  reset() {
    this.cleanup();
    this.setup();
  }

  createShaderProgram() {
    // Vertex shader - positions vertices
    const vsSource = `#version 300 es
      in vec4 aPosition;
      void main() {
        gl_Position = aPosition;
      }`;

    // Fragment shader - performs heavy computation
    const fsSource = `#version 300 es
      precision highp float;
      uniform float uSeed;
      out vec4 fragColor;
      
      float mandelbrot(vec2 c) {
        vec2 z = vec2(0.0);
        for(int i = 0; i < 500; i++) {  // Increased iterations
          float x = z.x * z.x - z.y * z.y + c.x;
          float y = 2.0 * z.x * z.y + c.y;
          
          if(x * x + y * y > 4.0) {
            return float(i) / 500.0;  // Normalized iteration count
          }
          z = vec2(x, y);
        }
        return 0.0;
      }
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      void main() {
        vec2 coord = gl_FragCoord.xy / 1024.0 * 4.0 - 2.0;
        coord = coord * (1.0 + sin(uSeed) * 0.1); // Animate zoom
        coord = coord + vec2(sin(uSeed * 0.5), cos(uSeed * 0.3)) * 0.5; // Animate position
        
        float value = mandelbrot(coord);
        vec3 color = hsv2rgb(vec3(value + uSeed * 0.1, 0.8, value));
        fragColor = vec4(color, 1.0);
      }`;

    // Create and compile shaders
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vsSource);
    this.gl.compileShader(vertexShader);

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fsSource);
    this.gl.compileShader(fragmentShader);

    // Create program
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    // Cleanup shaders
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return this.program;
  }

  async runBenchmark(seed, onProgress) {
    if (this.isRunning) {
      return Promise.reject(new Error('Benchmark already running'));
    }

    this.isRunning = true;
    const program = this.createShaderProgram();
    this.gl.useProgram(program);

    // Create a square to render
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ]);

    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    const positionAttributeLocation = this.gl.getAttribLocation(program, 'aPosition');
    this.gl.enableVertexAttribArray(positionAttributeLocation);
    this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

    const seedLocation = this.gl.getUniformLocation(program, 'uSeed');
    
    // Increased number of frames for a longer benchmark
    const totalFrames = 1000;  // 5x longer
    let frames = 0;
    let lastTime = performance.now();
    let lastFpsUpdate = performance.now();
    let framesSinceLastUpdate = 0;
    let totalFps = 0;
    let fpsReadings = 0;
    
    return new Promise((resolve, reject) => {
      const renderFrame = () => {
        if (!this.isRunning) {
          reject(new Error('Benchmark stopped'));
          return;
        }

        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // Update seed based on time and initial seed
        const seedValue = (parseFloat(seed) + frames * 0.01) % 2.0;
        this.gl.uniform1f(seedLocation, seedValue);

        // Render
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        frames++;
        framesSinceLastUpdate++;

        // Calculate progress
        const progress = frames / totalFrames;

        // Update FPS every 100ms
        if (currentTime - lastFpsUpdate >= 100) {
          const currentFps = (framesSinceLastUpdate * 1000) / (currentTime - lastFpsUpdate);
          totalFps += currentFps;
          fpsReadings++;
          onProgress(progress, currentFps);
          framesSinceLastUpdate = 0;
          lastFpsUpdate = currentTime;
        } else {
          onProgress(progress);
        }

        if (frames < totalFrames) {
          requestAnimationFrame(renderFrame);
        } else {
          this.cleanup();
          // Return average FPS over the entire benchmark
          resolve(totalFps / fpsReadings);
        }
      };

      requestAnimationFrame(renderFrame);
    });
  }
}

export default GPUBenchmark; 