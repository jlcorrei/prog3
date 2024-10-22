/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  
const WIN_LEFT = 0; const WIN_RIGHT = 1;  
const WIN_BOTTOM = 0; const WIN_TOP = 1;  
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; 
var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space

/* webgl globals */
var gl = null; 
var vertexBuffer; 
var triangleBuffer; 
var triBufferSize; 
var altPosition; 
var vertexPositionAttrib; 
var altPositionUniform; 
var shaderProgram;
var modelViewMatrix;
var coordArray = [];

// Camera control variables
var viewMatrix;
var eyeDirection = new vec3.fromValues(0, 0, 1);
var upVector = new vec3.fromValues(0, 1, 0);

// Model transformation variables
var selectedModelIndex = -1; // No model selected initially
var models = []; // To store models
var scale = 1.0;

// ASSIGNMENT HELPER FUNCTIONS

function getJSONFile(url, descr) {
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
}

function setupWebGL() {
    var canvas = document.getElementById("myWebGLCanvas");
    gl = canvas.getContext("webgl");

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clearDepth(1.0);
            gl.enable(gl.DEPTH_TEST);
        }
    } catch (e) {
        console.log(e);
    }
}

function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != String.null) { 
        var whichSetVert, whichSetTri; 
        var coordArray = []; 
        var normalArray = []; 
        var colorArray = [];

        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            var vertices = inputTriangles[whichSet].vertices;
            var normals = inputTriangles[whichSet].normals; // assuming normals are provided in JSON
            var colors = inputTriangles[whichSet].material.diffuse; // assuming material colors are in 'material'

            for (whichSetVert = 0; whichSetVert < vertices.length; whichSetVert++) {
                coordArray = coordArray.concat(vertices[whichSetVert]);
                normalArray = normalArray.concat(normals[whichSetVert]);
                colorArray = colorArray.concat(colors);
            }
        }

        // send vertex coords to webGL
        vertexBuffer = gl.createBuffer(); 
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); 
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); 

        // send normals to webGL
        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        // send colors to webGL
        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);
    } 
}


function setupShaders() {
    // vertex shader
    var vShaderCode = `
        attribute vec3 aVertexPosition;
        attribute vec3 aVertexNormal;
        attribute vec4 aVertexColor;
        uniform mat4 uMVPMatrix;
        uniform mat4 uModelMatrix; // New: model transformation matrix
        varying vec3 vNormal;
        varying vec3 vFragPos;
        varying vec4 vColor;
        void main(void) {
            vec4 transformedPosition = uModelMatrix * vec4(aVertexPosition, 1.0);
            gl_Position = uMVPMatrix * transformedPosition;
            vFragPos = vec3(transformedPosition);
            vNormal = aVertexNormal;
            vColor = aVertexColor;
        }
    `;

    // fragment shader
    var fShaderCode = `
        precision mediump float;
        varying vec3 vNormal;
        varying vec3 vFragPos;
        varying vec4 vColor;
        uniform vec3 lightPos;
        uniform vec3 viewPos;
        uniform vec3 lightColor;

        void main(void) {
            vec3 ambient = 0.1 * lightColor;

            vec3 norm = normalize(vNormal);
            vec3 lightDir = normalize(lightPos - vFragPos);
            float diff = max(dot(norm, lightDir), 0.0);
            vec3 diffuse = diff * lightColor;

            vec3 viewDir = normalize(viewPos - vFragPos);
            vec3 reflectDir = reflect(-lightDir, norm);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
            vec3 specular = 0.5 * spec * lightColor;

            vec3 result = (ambient + diffuse + specular) * vec3(vColor);
            gl_FragColor = vec4(result, 1.0);
        }
    `;

    // compile shaders
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vShaderCode);
    gl.compileShader(vertexShader);

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fShaderCode);
    gl.compileShader(fragmentShader);

    // check for compilation errors
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        alert("Vertex shader compilation error: " + gl.getShaderInfoLog(vertexShader));
        return null;
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        alert("Fragment shader compilation error: " + gl.getShaderInfoLog(fragmentShader));
        return null;
    }

    // create and link the program
    var shaderProgram = gl.createProgram();
    // var modelViewMatrixUniform = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");
    // var mvpUniform = gl.getUniformLocation(shaderProgram, "uMVPMatrix");
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Failed to setup shaders");
        return null;
    }

    gl.useProgram(shaderProgram);

    // locate attributes and uniforms
    vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    colorAttrib = gl.getAttribLocation(shaderProgram, "aVertexColor");
    mvpUniform = gl.getUniformLocation(shaderProgram, "uMVPMatrix");
    lightPosUniform = gl.getUniformLocation(shaderProgram, "lightPos");
    viewPosUniform = gl.getUniformLocation(shaderProgram, "viewPos");
    lightColorUniform = gl.getUniformLocation(shaderProgram, "lightColor");
    gl.getUniformLocation(shaderProgram, "uModelMatrix"); // Ensure matrix uniform is located

    return shaderProgram;  // Return the shader program
}

function renderTriangles() {
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // bind vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexPositionAttrib);

    // bind normals
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexNormalAttrib);

    // bind colors
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorAttrib, 4, gl.FLOAT, false, 0, 0); // assuming colors are in vec4
    gl.enableVertexAttribArray(colorAttrib);

    // set uniforms (MVP matrix, light positions, etc.)
    gl.uniform3f(lightPosUniform, -0.5, 1.5, -0.5); // example light position
    gl.uniform3f(viewPosUniform, Eye[0], Eye[1], Eye[2]); // eye position
    gl.uniform3f(lightColorUniform, 1.0, 1.0, 1.0); // white light

    // draw triangles
    // gl.drawArrays(gl.TRIANGLES, 0, coordArray.length / 3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(renderTriangles);
}


/* MAIN -- HERE is where execution begins after window load */

function main() {
    setupWebGL(); 
    setupShaders();
    loadTriangles(); 
     
    renderTriangles(); 
}

document.addEventListener("keydown", function(event) {
    const key = event.key;
    const translationAmount = 0.05; // Translation amount for camera movement
    const rotationAmount = 0.1; // Rotation amount for camera rotation

    // Camera movement
    if (key === 'a') { // Move left
        Eye[0] -= translationAmount;
    }
    else if (key === 'd') { // Move right
        Eye[0] += translationAmount;
    }
    else if (key === 'w') { // Move forward
        Eye[2] += translationAmount;
    }
    else if (key === 's') { // Move backward
        Eye[2] -= translationAmount;
    }
    else if (key === 'q') { // Move up
        Eye[1] -= translationAmount;
    }
    else if (key === 'e') { // Move down
        Eye[1] += translationAmount;
    }
    else if (key === 'A' || key === 'D') {
        if (key === 'A') {
            mat4.rotate(modelViewMatrix, modelViewMatrix, -0.01, [0, 1, 0]);
        } else {
            mat4.rotate(modelViewMatrix, modelViewMatrix, 0.01, [0, 1, 0]);
        }
    }
    else if (key === 'W') { // Pitch up
        mat4.rotateX(modelViewMatrix, modelViewMatrix, -rotationAmount);
    }
    else if (key === 'S') { // Pitch down
        mat4.rotateX(modelViewMatrix, modelViewMatrix, rotationAmount);
    }
    else if (key === ' ') { // Deselect model
        selectedModelIndex = -1;
        scale = 1.0; // Reset scale
    }
    else if (key === 'ArrowRight') { // Next model
        selectedModelIndex = (selectedModelIndex + 1) % models.length;
        renderTriangles();
    }
    else if (key === 'ArrowLeft') { // Previous model
        selectedModelIndex = (selectedModelIndex - 1 + models.length) % models.length;
        renderTriangles();
    }

    // Handle scaling for selected model
    if (selectedModelIndex >= 0) {
        if (key === 'k') { // Scale up
            scale += 0.1;
        }
        else if (key === ';') { // Scale down
            scale = Math.max(1.0, scale - 0.1);
        }
    }
});