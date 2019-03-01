"use strict";

function ColorScheme(colors) {
    this.colors = colors || [
        [0.0, 0.0, 0.0],
        [1.0, 0.5, 0.0],
        [0.0, 0.5, 1.0],
        [0.5, 0.0, 1.0],
        [0.5, 0.1, 0.0],
    ];
}

ColorScheme.prototype.copy = function(){
    return new ColorScheme(this.colors.slice());
};

ColorScheme.prototype.equalsTo = function(other) {
    for (var i = 0; i < this.colors.length; i++) {
        for (var j = 0; j < 3; j++) {
            if (this.colors[i][j] !== other.colors[i][j]) {
                return false;
            }
        }
    }
    return true;
};

ColorScheme.prototype.setColorHex = function(colorIdx, hex) {
    var color = [];
    if (hex[0] === '#') {
        hex = hex.substring(1);
    }
    for (var i = 0; i < 3; i++) {
        color.push(parseInt(hex.substring(i * 2, i * 2 + 2), 16) / 255.0);
    }

    this.colors[colorIdx] = color;
};

ColorScheme.prototype.setColorHexes = function (hexes) {
    for (var i = 0; i < hexes.length; i++) {
        this.setColorHex(i, hexes[i]);
    }
};

ColorScheme.prototype.getColorHex = function (colorIdx) {
    var color = this.colors[colorIdx],
        s = '#';
    for (var i = 0; i < 3; i++) {
        var c = Math.floor(255 * color[i]).toString(16);
        if (c.length < 2) {
            c = '0' + c;
        }
        s += c;
    }
    return s;
};

function Viewport(center, scale, phi) {
    this.center = center || [0.0, 0.0];
    this.scale = scale || 4.0;
    this.phi = phi || 0.0;
}

Viewport.prototype.translate = function(dx, dy, w, h) {
    var wx = this.scale * dx / w,
        wy = this.scale * - dy / w,
        cs = Math.cos(this.phi),
        sn = Math.sin(this.phi);
    this.center[0] += cs * wx + sn * wy;
    this.center[1] += -sn * wx + cs * wy;
};

Viewport.prototype.zoom = function(rx, ry, w, h, ratio) {
    var dx = rx - w/2,
        dy = ry - h/2;
    this.translate(dx, dy, w, h);
    this.scale *= ratio;
    this.translate(-dx, -dy, w, h);
};

Viewport.prototype.copy = function() {
    return new Viewport(this.center.slice(), this.scale, this.phi);
};

Viewport.prototype.set = function(other) {
    this.center[0] = other.center[0];
    this.center[1] = other.center[1];
    this.scale = other.scale;
    this.phi = other.phi;
};

Viewport.prototype.equalsTo = function (other) {
    return this.center[0] === other.center[0]
        && this.center[1] === other.center[1]
        && this.scale === other.scale
        && this.phi === other.phi;
};

Viewport.prototype.reset = function (initialScale) {
    this.center[0] = 0.0;
    this.center[1] = 0.0;
    this.scale = initialScale || 1.0;
    this.phi = 0.0;
};

Viewport.prototype.contains = function (worldX, worldY, w, h) {
    var dx = this.center[0] - worldX,
        dy = this.center[1] - worldY,
        sy = this.scale * h / w;
    // TODO: take rotation into account
    return Math.abs(dx) <= this.scale * 0.5 && Math.abs(dy) <= sy * 0.5;
};

var colorInputs = document.getElementById('scheme-colors').getElementsByTagName('input');
var client = null;

function connectClicked() {
    var url = document.getElementById('clr-host').value;
    if (url.indexOf(':') < 0) {
        url += ':8080';
    }

    if (client !== null) {
        client.setHost(url);
    } else {
        client = new colouro.Client({
            host: url,
            colorHandlerFunc: function (colors, semantics) {
                for (var i = 0; i < colors.length; i++) {
                    kit.context.scheme.setColorHex(semantics[i], colors[i]);
                    colorInputs[semantics[i]].value = colors[i];
                }
            }
        });
    }
}

function modeChanged(newMode) {
    if (kit.context.mode === newMode) return;
    kit.context.mode = newMode;
    kit.context.viewport.reset(kit.context.initialScale);
}

function toggleZenMode() {
    document.body.classList.toggle('zen');
}


var app = {
    init: function(gl) {
        const prog = twgl.createProgramInfo(gl, ['vs', 'fs']);
        const arrays = {
            position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]
        };
        const vb = twgl.createBufferInfoFromArrays(gl, arrays);

        const initialColors = ['#007549','#fbdecb','#005a6e','#feedea','#fb4300'];
        const initialScale = 4.0;

        var scheme = new ColorScheme();
        scheme.setColorHexes(initialColors);
        return {
            gl:gl,
            prog:prog,
            vb:vb,
            mode: 0,
            scheme: scheme,
            initialScale: initialScale,
            viewport: new Viewport([0.0, 0.0], initialScale),
            mouseDown: null,
            lastRenderState: {},
            paused: true
        };
    },

    render: function(gl, appContext, time) {
        if (!appContext.paused) {
            appContext.viewport.phi = 0.001 * time;
        }

        const unchanged = appContext.lastRenderState !== null
            && appContext.lastRenderState.mode === appContext.mode
            && appContext.lastRenderState.width === gl.canvas.clientWidth
            && appContext.lastRenderState.height === gl.canvas.clientHeight
            && appContext.lastRenderState.scheme.equalsTo(appContext.scheme)
            && appContext.lastRenderState.viewport.equalsTo(appContext.viewport);

        if (unchanged) {
            return;
        }

        const uniforms = {
            //time: time*0.001,
            resolution: [gl.canvas.width, gl.canvas.height],
            zoomCenter: appContext.viewport.center,
            zoomSize: appContext.viewport.scale,
            maxIterations: 200,
            phi: appContext.viewport.phi,
            color0: appContext.scheme.colors[0],
            color1: appContext.scheme.colors[1],
            color2: appContext.scheme.colors[2],
            color3: appContext.scheme.colors[3],
            color4: appContext.scheme.colors[4],
            mode: appContext.mode,
        };

        gl.useProgram(appContext.prog.program);
        twgl.setBuffersAndAttributes(gl, appContext.prog, appContext.vb);
        twgl.setUniforms(appContext.prog, uniforms);
        twgl.drawBufferInfo(gl, appContext.vb);

        if (appContext.lastRenderState.viewport === undefined) {
            appContext.lastRenderState.viewport = appContext.viewport.copy();
        } else {
            appContext.lastRenderState.viewport.set(appContext.viewport);
        }

        if (appContext.lastRenderState.scheme === undefined
            || !appContext.scheme.equalsTo(appContext.lastRenderState.scheme)) {
            appContext.lastRenderState.scheme = appContext.scheme.copy();
        }

        appContext.lastRenderState.mode = appContext.mode;
        appContext.lastRenderState.width = gl.canvas.clientWidth;
        appContext.lastRenderState.height = gl.canvas.clientHeight;
    }
};

function translate(appContext, d){
    appContext.viewport.translate(d[0], d[1], appContext.gl.canvas.width, appContext.gl.canvas.height);
}

function zoom(appContext, d, x, y) {
    appContext.viewport.zoom(x, y, appContext.gl.canvas.width, appContext.gl.canvas.height, d);
}

var mouseCtrl = webGlKit.createMousePanZoomController(translate, zoom),
    touchCtrl = webGlKit.createTouchPanZoomController(translate, zoom);

app = Object.assign(app, mouseCtrl, touchCtrl);


var kit = webGlKit.create('main-canvas', app);
for (var i = 0; i < 5; i++) {
    colorInputs[i].value = kit.context.scheme.getColorHex(i);
}

