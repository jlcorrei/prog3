/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space
var lookAt = new vec4.fromValues(0, 0, 1); // default lookAt position in world space
var lookUp = new vec4.fromValues(0, 1, 0); // default lookUp vector in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer
var altPosition; // flag indicating whether to alter vertex positions
var vertexPositionAttrib; // where to put position for vertex shader
var altPositionUniform; // where to put altPosition flag for vertex shader

var vertexColorAttrib;
var vertexNormalAttrib;
var ambientAttrib;
var specularAttrib;
var shininessAttrib;

var colorBuffer;
var normalBuffer;
var ambientBuffer;
var specularBuffer;
var shininessBuffer;

var viewPositionUniform;
var lightPositionUniform;
var lightColorUniform;

var shaderProgram;
// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var indexArray = [];
        var colorArray = [];
        var specularArray = [];
        var ambientArray = [];
        var normalArray = [];
        var shininessArray = [];
        var count = 0;
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            var material = inputTriangles[whichSet].material;
            var ambient = material.ambient;
            var diffuse = material.diffuse;
            var specular = material.specular;
            var shininess = material.n;
            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++){
                coordArray = coordArray.concat(inputTriangles[whichSet].vertices[whichSetVert]);
                colorArray = colorArray.concat(diffuse);
                ambientArray = ambientArray.concat(ambient);
                specularArray = specularArray.concat(specular);
                normalArray = normalArray.concat(inputTriangles[whichSet].normals[whichSetVert]);
                console.log(normalArray);
                // console.log(inputTriangles[whichSet].vertices[whichSetVert]);
            }
            var triangles = inputTriangles[whichSet].triangles;
            for (var whichSetTri = 0; whichSetTri < triangles.length; whichSetTri++) {
                var triangle = triangles[whichSetTri];
                indexArray.push(triangle[0] + count);
                indexArray.push(triangle[1] + count);
                indexArray.push(triangle[2] + count);

                shininessArray.push(shininess);
                shininessArray.push(shininess);
                shininessArray.push(shininess);


            }
            count += inputTriangles[whichSet].vertices.length;
        } // end for each triangle set 
        // console.log(coordArray.length);
        // send the vertex coords to webGL

        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer
        
        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);

        ambientBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

        specularBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

        shininessBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, shininessBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shininessArray), gl.STATIC_DRAW)

        triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);

        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        triBufferSize = indexArray.length;
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
    precision mediump float;

    varying vec3 fragColor;
    varying vec3 fragNormal;
    varying vec3 fragPosition;
    varying vec3 specularColor;
    varying vec3 ambientColor;
    varying float shininess;

    uniform vec3 lightPosition;
    uniform vec3 viewPosition;
    uniform vec3 lightColor;

    void main(void) {
        vec3 normal = normalize(fragNormal);
        vec3 lightDir = normalize(lightPosition - fragPosition);

        vec3 ambient = ambientColor * lightColor;

        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * lightColor;

        vec3 viewDir = normalize(viewPosition - fragPosition);
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
        vec3 specular = specularColor * spec * lightColor;

        vec3 finalColor = (ambient + diffuse + specular) * fragColor;
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition;
        attribute vec3 aVertexNormal;
        attribute vec4 aVertexColor;
        uniform mat4 uMVPMatrix;
        uniform mat4 uModelMatrix; // New: model transformation matrix
        varying vec3 vNormal;
        varying vec3 vFragPos;
        varying vec4 vColor;
        varying vec3 fragColor;
        void main(void) {
            vec4 transformedPosition = uModelMatrix * vec4(aVertexPosition, 1.0);
            gl_Position = uMVPMatrix * transformedPosition;
            vFragPos = vec3(transformedPosition);
            vNormal = aVertexNormal;
            vColor = aVertexColor;
            fragColor = aVertexColor.xyz;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                altPositionUniform = gl.getUniformLocation(shaderProgram, "altPosition");
                
                vertexColorAttrib = gl.getAttribLocation(shaderProgram, "vertexColor");
                gl.enableVertexAttribArray(vertexColorAttrib);

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);

                specularAttrib = gl.getAttribLocation(shaderProgram, "specAttrib");
                gl.enableVertexAttribArray(specularAttrib);

                ambientAttrib = gl.getAttribLocation(shaderProgram, "ambAttrib");
                gl.enableVertexAttribArray(ambientAttrib);

                shininessAttrib = gl.getAttribLocation(shaderProgram, "shinAttrib");
                gl.enableVertexAttribArray(shininessAttrib);

                viewPositionUniform = gl.getUniformLocation(shaderProgram, "viewPosition");
                lightColorUniform = gl.getUniformLocation(shaderProgram, "lightColor");
                lightPositionUniform = gl.getUniformLocation(shaderProgram, "lightPosition");
                
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
    // altPosition = false;
    // setTimeout(function alterPosition() {
    //     altPosition = !altPosition;
    //     setTimeout(alterPosition, 2000);
    // }, 2000);s
} // end setup shaders
var bgColor = 0;
// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    // bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    // gl.clearColor(bgColor, 0, 0, 1.0);
    gl.useProgram(shaderProgram);
    
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.uniform1i(altPositionUniform, altPosition); // feed

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(vertexColorAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
    gl.vertexAttribPointer(ambientAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
    gl.vertexAttribPointer(specularAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, shininessBuffer);
    gl.vertexAttribPointer(shininessAttrib, 1, gl.FLOAT, false, 0, 0);

    gl.uniform3fv(lightPositionUniform, [-0.5, 1.5, -0.5]);
    gl.uniform3fv(viewPositionUniform, [Eye[0], Eye[1], Eye[2]]);
    gl.uniform3fv(lightColorUniform, [1.0, 1.0, 1.0]);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
    console.log(gl.getProgramParameter(shaderProgram, gl.ACTIVE_UNIFORMS));
    console.log(gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES));
    console.log(gl.getProgramParameter(shaderProgram, gl.LINK_STATUS));
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0); // new rendering

    // gl.drawArrays(gl.TRIANGLES,0,3); // render
    requestAnimationFrame(renderTriangles);
} // end render triangles

function handleKeydown(event) {
    switch (event.key) {
      case 'a':
        // Translate view left
        Eye[0] -= 0.1;
        lookAt[0] -= 0.1;
        break;
      case 'd':
        // Translate view right
        Eye[0] += 0.1;
        lookAt[0] += 0.1;
        break;
      case 'w':
        // Translate view forward
        Eye[2] -= 0.1;
        lookAt[2] -= 0.1;
        break;
      case 's':
        // Translate view backward
        Eye[2] += 0.1;
        lookAt[2] += 0.1;
        break;
      case 'q':
        // Translate view up
        Eye[1] += 0.1;
        lookAt[1] += 0.1;
        break;
      case 'e':
        // Translate view down
        Eye[1] -= 0.1;
        lookAt[1] -= 0.1;
        break;
      case 'A':
        // Rotate view left
        let angle = 0.1;
        let cosAngle = Math.cos(angle);
        let sinAngle = Math.sin(angle);
        let tempX = lookAt[0];
        lookAt[0] = lookAt[0] * cosAngle - lookAt[2] * sinAngle;
        lookAt[2] = tempX * sinAngle + lookAt[2] * cosAngle;
        break;
      case 'D':
        // Rotate view right
        angle = -0.1;
        cosAngle = Math.cos(angle);
        sinAngle = Math.sin(angle);
        tempX = lookAt[0];
        lookAt[0] = lookAt[0] * cosAngle - lookAt[2] * sinAngle;
        lookAt[2] = tempX * sinAngle + lookAt[2] * cosAngle;
        break;
      case 'W':
        // Rotate view forward
        angle = 0.1;
        cosAngle = Math.cos(angle);
        sinAngle = Math.sin(angle);
        let tempY = lookAt[1];
        lookAt[1] = lookAt[1] * cosAngle - lookAt[2] * sinAngle;
        lookAt[2] = tempY * sinAngle + lookAt[2] * cosAngle;
        break;
      case 'S':
        // Rotate view backward
        angle = -0.1;
        cosAngle = Math.cos(angle);
        sinAngle = Math.sin(angle);
        tempY = lookAt[1];
        lookAt[1] = lookAt[1] * cosAngle - lookAt[2] * sinAngle;
        lookAt[2] = tempY * sinAngle + lookAt[2] * cosAngle;
        break;
    }
    // Recalculate viewing transform matrix
    viewingTransform = mat4.create();
    mat4.lookAt(viewingTransform, Eye, lookAt, lookUp);
  }

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
} // end main

document.addEventListener('keydown', handleKeydown);

