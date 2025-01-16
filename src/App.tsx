import { useEffect, useRef } from 'react'
import vertexShaderSource from './shaders/world.vert?raw'
import fragmentShaderSource from './shaders/world.frag?raw'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const eyeUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const lookDirectionUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const voxelDataRef = useRef<Uint8Array | null>(null)
  const textureRef = useRef<WebGLTexture | null>(null)
  const lastTimeRef = useRef<number>(0)
  const eyeRef = useRef([0.5, 0.5, -1.0])
  const azimuthRef = useRef(0.0)
  const elevationRef = useRef(0.0)
  const velocityRef = useRef([0.0, 0.0])
  const keysRef = useRef({ w: false, a: false, s: false, d: false })

  const normalize = (v: number[]) => {
    const length = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0))
    return v.map(val => val / length)
  }

  const updateTexture = (gl: WebGL2RenderingContext, texture: WebGLTexture, voxelData: Uint8Array) => {
    gl.bindTexture(gl.TEXTURE_3D, texture)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 16, 16, 16, 0, gl.RED, gl.UNSIGNED_BYTE, voxelData)
  }

  const resizeCanvas = (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) => {
    const displayWidth = canvas.clientWidth / 4
    const displayHeight = canvas.clientHeight / 4

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth
      canvas.height = displayHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keysRef.current = { ...keysRef.current, [event.key]: true }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current = { ...keysRef.current, [event.key]: false }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const handleMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement !== canvas) {
          return
        }
        azimuthRef.current = azimuthRef.current + event.movementX * 0.01
        elevationRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, elevationRef.current - event.movementY * 0.01))
      }

      const handleClick = (event: MouseEvent) => {
        if (document.pointerLockElement === canvas) {
          const gl = glRef.current
          const voxelData = voxelDataRef.current
          const texture = textureRef.current
          let prevIndex: number | null = null
          if (gl && voxelData && texture) {
            const lookDirection = [
              Math.cos(elevationRef.current) * Math.sin(azimuthRef.current),
              Math.sin(elevationRef.current),
              Math.cos(elevationRef.current) * Math.cos(azimuthRef.current)
            ]
            const step = 0.01
            const reach = 20.0
            for (let t = 0.0; t < reach; t += step) {
              const pos = [
                eyeRef.current[0] + t * lookDirection[0],
                eyeRef.current[1] + t * lookDirection[1],
                eyeRef.current[2] + t * lookDirection[2]
              ]
              const wrappedPos = pos.map(p => ((Math.floor(p * 16) % 16) + 16) % 16) // Ensure positive values
              const index = wrappedPos[0] + wrappedPos[1] * 16 + wrappedPos[2] * 16 * 16
              if (voxelData[index] > 0) {
                console.log(event.button)
                console.log(prevIndex)
                if (event.button === 0) {
                  voxelData[index] = 0
                  updateTexture(gl, texture, voxelData)
                } else if (event.button === 2 && prevIndex !== null) {
                  console.log('setting to 255')
                  voxelData[prevIndex] = 255
                  updateTexture(gl, texture, voxelData)
                }
                break
              }
              prevIndex = index
            }
          }
        } else {
          canvas.requestPointerLock()
        }
      }

      canvas.addEventListener('click', handleClick)
      document.addEventListener('mousemove', handleMouseMove)

      return () => {
        canvas.removeEventListener('click', handleClick)
        document.removeEventListener('mousemove', handleMouseMove)
      }
    }
  }, [])

  useEffect(() => {
    console.log("init")
    const canvas = canvasRef.current
    if (canvas) {
      const gl = canvas.getContext('webgl2')
      if (!gl) {
        console.error('WebGL2 is not available in your browser.')
        return
      }
      glRef.current = gl

      const createShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
        const shader = gl.createShader(type)
        if (!shader) {
          console.error('Failed to create shader')
          return null
        }
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error(gl.getShaderInfoLog(shader))
          gl.deleteShader(shader)
          return null
        }
        return shader
      }

      const createProgram = (gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
        const program = gl.createProgram()
        gl.attachShader(program, vertexShader)
        gl.attachShader(program, fragmentShader)
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error(gl.getProgramInfoLog(program))
          gl.deleteProgram(program)
          return null
        }
        return program
      }

      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
      if (!vertexShader) {
        console.error('Failed to create vertex shader')
        return
      }
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
      if (!fragmentShader) {
        console.error('Failed to create fragment shader')
        return
      }
      const program = createProgram(gl, vertexShader, fragmentShader)
      if (!program) {
        console.error('Failed to create program')
        return
      }
      programRef.current = program

      const positionAttributeLocation = gl.getAttribLocation(program, 'a_position')
      const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution')
      const voxelDataUniformLocation = gl.getUniformLocation(program, 'u_voxelData')
      eyeUniformLocationRef.current = gl.getUniformLocation(program, 'u_eye')
      lookDirectionUniformLocationRef.current = gl.getUniformLocation(program, 'u_lookDirection')

      const positionBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      const positions = [
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

      const size = 16
      const voxelData = new Uint8Array(size * size * size)
      const center = size / 2
      const radius = size / 6
      for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const dx = x - center
            const dy = y - center
            const dz = z - center
            if (dx * dx + dy * dy + dz * dz < radius * radius) {
              voxelData[x + y * size + z * size * size] = 255
            }
          }
        }
      }
      voxelDataRef.current = voxelData

      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_3D, texture)
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, size, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, voxelData)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
      textureRef.current = texture

      resizeCanvas(canvas, gl)

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(program)
      gl.enableVertexAttribArray(positionAttributeLocation)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0)
      gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height)
      gl.uniform1i(voxelDataUniformLocation, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_3D, texture)

      const handleResize = () => resizeCanvas(canvas, gl)
      window.addEventListener('resize', handleResize)
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  useEffect(() => {
    console.log("render")
    const gl = glRef.current
    const program = programRef.current
    const eyeUniformLocation = eyeUniformLocationRef.current
    const lookDirectionUniformLocation = lookDirectionUniformLocationRef.current

    const update = (time: number) => {
      const deltaTime = (time - lastTimeRef.current) / 1000
      lastTimeRef.current = time

      let newVelocity = [...velocityRef.current]
      const acceleration = 0.5
      const deceleration = 2
      if (keysRef.current.w) newVelocity[1] += acceleration * deltaTime
      if (keysRef.current.s) newVelocity[1] -= acceleration * deltaTime
      if (keysRef.current.a) newVelocity[0] += acceleration * deltaTime
      if (keysRef.current.d) newVelocity[0] -= acceleration * deltaTime

      newVelocity[0] *= 1 - deceleration * deltaTime
      newVelocity[1] *= 1 - deceleration * deltaTime

      velocityRef.current = newVelocity

      const lookDirection = [
        Math.cos(elevationRef.current) * Math.sin(azimuthRef.current),
        Math.sin(elevationRef.current),
        Math.cos(elevationRef.current) * Math.cos(azimuthRef.current)
      ]
      const forwardDirection = [
        Math.sin(azimuthRef.current),
        0,
        Math.cos(azimuthRef.current)
      ]
      const rightDirection = [
        Math.sin(azimuthRef.current - Math.PI / 2),
        0,
        Math.cos(azimuthRef.current - Math.PI / 2)
      ]

      const newEye = [
        eyeRef.current[0] + (forwardDirection[0] * newVelocity[1] + rightDirection[0] * newVelocity[0]) * deltaTime,
        eyeRef.current[1],
        eyeRef.current[2] + (forwardDirection[2] * newVelocity[1] + rightDirection[2] * newVelocity[0]) * deltaTime
      ]
      eyeRef.current = newEye

      if (gl && program && eyeUniformLocation && lookDirectionUniformLocation) {
        const render = () => {
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.useProgram(program)
          gl.uniform3fv(eyeUniformLocation, newEye)
          gl.uniform3fv(lookDirectionUniformLocation, lookDirection)
          gl.drawArrays(gl.TRIANGLES, 0, 6)
        }
        render()
      }

      requestAnimationFrame(update)
    }

    requestAnimationFrame(update)
  }, [])

  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  )
}

export default App
