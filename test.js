/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  
const WIN_LEFT = 0; const WIN_RIGHT = 1;  
const WIN_BOTTOM = 0; const WIN_TOP = 1;  
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; 
var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space

/* webgl globals */
var gl = null; 
var vertexBuffer; 
var triangleBuffer; 
var triBufferSize; 
var altPosition; 
var vertexPositionAttrib; 
var altPositionUniform; 

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
        var coordArray = []; // 1D array of vertex coords for WebGL
        var normalArray = []; // 1D array of vertex normals for WebGL

        // Populate models array and build coord and normal arrays
        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            var model = {
                vertices: inputTriangles[whichSet].vertices,
                normals: inputTriangles[whichSet].normals,
                color: inputTriangles[whichSet].color,
                // Store indices for rendering if needed
            };
            models.push(model);
            
            // Add vertices to the coordArray
            for (var i = 0; i < model.vertices.length; i++) {
                coordArray = coordArray.concat(model.vertices[i]);
            }

            // Add normals to the normalArray
            if (model.normals) { // Check if normals exist
                for (var j = 0; j < model.normals.length; j++) {
                    normalArray = normalArray.concat(model.normals[j]);
                }
            } else {
                console.warn("No normals found for model set " + whichSet);
            }
        } // end for each triangle set 

        // Send the vertex coords to WebGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

        // Send the vertex normals to WebGL
        if (normalArray.length > 0) { // Check if normals were loaded
            normalBuffer = gl.createBuffer(); // Create buffer for normals
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); // Activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW); // Normals to that buffer
        } else {
            console.warn("No vertex normals to upload to GPU.");
        }

        triBufferSize = coordArray.length / 3; // Calculate the number of triangles based on vertex count
    } // end if triangles found
} // end loadTriangles

function setupShaders() {
    var fShaderCode = `
        precision mediump float;
        varying vec3 vNormal;
        varying vec3 vLight;
        uniform vec3 lightPos;

        void main(void) {
            vec3 ambientColor = vec3(1.0, 1.0, 1.0) * 0.1; // ambient light
            vec3 lightDir = normalize(vLight);
            float diff = max(dot(vNormal, lightDir), 0.0);
            vec3 diffuseColor = vec3(1.0, 0.0, 0.0) * diff; // replace with actual color
            gl_FragColor = vec4(ambientColor + diffuseColor, 1.0);
        }
    `;

    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec3 vNormal;
        varying vec3 vLight;

        void main(void) {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);
            vNormal = normalize(vec3(modelViewMatrix * vec4(vertexNormal, 0.0)));
            vLight = normalize(vec3(0.5, 1.5, -0.5)); // light position
        }
    `;

    // Same shader setup as your original code, but also handling vertex normals...
}

function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set up view and projection matrices
    var projectionMatrix = mat4.create();
    var modelViewMatrix = mat4.create();
    
    // Create the projection matrix
    mat4.perspective(projectionMatrix, Math.PI / 4, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
    mat4.lookAt(modelViewMatrix, Eye, vec3.add(vec3.create(), Eye, eyeDirection), upVector);

    // Iterate through each model
    for (let i = 0; i < models.length; i++) {
        var model = models[i];

        // Reset modelViewMatrix for each model
        var modelViewMatrixForModel = mat4.create();
        mat4.multiply(modelViewMatrixForModel, modelViewMatrix, model.transform);
        
        // Bind vertex buffer and draw the triangles for this model
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vertexPositionAttrib); // Enable the vertex position attribute

        // If you have normals, bind the normal buffer
        if (normalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
            gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(vertexNormalAttrib); // Enable the vertex normal attribute
        }

        // Send the matrices to the shader
        gl.uniformMatrix4fv(modelViewMatrixUniform, false, modelViewMatrixForModel);
        gl.uniformMatrix4fv(projectionMatrixUniform, false, projectionMatrix);

        // Draw call should use the model's data
        gl.drawArrays(gl.TRIANGLES, 0, model.vertices.length); // Draw all vertices of the model
    }

    requestAnimationFrame(renderTriangles);
}


/* MAIN -- HERE is where execution begins after window load */

function main() {
    setupWebGL(); 
    loadTriangles(); 
    setupShaders(); 
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
        Eye[1] += translationAmount;
    }
    else if (key === 'e') { // Move down
        Eye[1] -= translationAmount;
    }
    else if (key === 'A') { // Rotate left
        mat4.rotateY(modelViewMatrix, modelViewMatrix, -rotationAmount);
    }
    else if (key === 'D') { // Rotate right
        mat4.rotateY(modelViewMatrix, modelViewMatrix, rotationAmount);
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
    }
    else if (key === 'ArrowLeft') { // Previous model
        selectedModelIndex = (selectedModelIndex - 1 + models.length) % models.length;
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