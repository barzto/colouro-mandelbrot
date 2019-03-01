"use strict";

(function(){

    function createMousePanZoomController(translateCallback, zoomCallback) {
        var lastPos = null;
        const maxDelta = 5.0;

        return {
            mouseDown: function (appContext, event){
                lastPos = [event.clientX, event.clientY];
            },
            mouseMove: function (appContext, event){
                if (lastPos === null) return;

                var d = [lastPos[0] - event.clientX, lastPos[1] - event.clientY];
                lastPos = [event.clientX, event.clientY];
                translateCallback(appContext, d);
            },
            mouseUp: function (appContext, event) {
                lastPos = null;
            },
            mouseLeave: function (appContext, event) {
                lastPos = null;
            },
            wheel: function (appContext, event){
                var d = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
                d = Math.min(maxDelta, Math.max(-maxDelta, d));
                zoomCallback(appContext, Math.pow(1.01, d), event.clientX, event.clientY);
            }
        };
    }

    function createTouchPanZoomController(translateCallback, zoomCallback) {
        var processingTouches = [];

        function createTouchRecord(t) {
            return {id: t.identifier, x: t.clientX, y: t.clientY};
        }

        function addTouch(t) {
            processingTouches.push(createTouchRecord(t));
        }

        function updateTouch(t, index) {
            index = index || getTouchIndex(t);
            if (index < 0) {
                addTouch(t);
            } else {
                processingTouches.splice(index, 1, createTouchRecord(t));
                var rec = processingTouches[index];
                rec.x = t.clientX;
                rec.y = t.clientY;
            }
        }

        function removeTouch(t) {
            var idx = getTouchIndex(t);
            if (idx >= 0) {
                processingTouches.splice(idx, 1);
            }
        }

        function getTouchIndexById(id, touches) {
            touches = touches || processingTouches;
            for (var i = 0; i < touches.length; i++) {
                if (touches[i].id === id) return i;
            }
            return -1;
        }

        function getTouchIndex(t) {
            return getTouchIndexById(t.identifier);
        }

        function forEachChangedTouches(e, cb) {
            var touches = e.changedTouches;
            for (var i = 0; i < touches.length; i++) {
                cb(touches[i]);
            }
        }

        function dist(a, b) {
            var x = a.x - b.x,
                y = a.y - b.y;
            return Math.sqrt(x * x + y * y);
        }

        function center(a, b) {
            return [0.5 * (a.x + b.x), 0.5 * (a.y + b.y)];
        }



        function handleTouches(oldTouches, newTouches, appContext) {
            if (newTouches.length === 1) {
                var dx = newTouches[0].x - oldTouches[0].x,
                    dy = newTouches[0].y - oldTouches[0].y;
                translateCallback(appContext, [-dx, -dy]);
            } else if (newTouches.length === 2) {
                var d0 = dist(oldTouches[0], oldTouches[1]),
                    d1 = dist(newTouches[0], newTouches[1]),
                    r = d0/d1,
                    c = center(newTouches[0], newTouches[1]);
                console.log(r, c);
                zoomCallback(appContext, r, c[0], c[1]);
            }
        }

        return {
            touchStart: function (appContext, e) {
                e.preventDefault();
                forEachChangedTouches(e, addTouch);
            },
            touchMove: function (appContext, e) {
                e.preventDefault();

                var lastTouches = processingTouches.slice();
                forEachChangedTouches(e, updateTouch);
                handleTouches(lastTouches, processingTouches, appContext);
            },
            touchEnd: function (appContext, e) {
                e.preventDefault();
                forEachChangedTouches(e, removeTouch);
            },
            touchCancel: function (appContext, e) {
                e.preventDefault();
                forEachChangedTouches(e, removeTouch);
            }
        }
    }

    function createKit(canvasId, opts){
        opts = opts || {};

        var canvas = document.getElementById(canvasId),
            gl = canvas.getContext('webgl');

        function defaultInit(gl) {
            const prog = twgl.createProgramInfo(gl, ['vs', 'fs']);
            const arrays = {
                position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0]
            };
            const vb = twgl.createBufferInfoFromArrays(gl, arrays);

            return {
                gl:gl,
                prog:prog,
                vb:vb,
                zoomCenter: [0.0, 0.0],
                zoomSize: 4.0,
                mouseDown: null
            };
        }

        function registerCallback(optsName, eventName) {
            const cb = opts[optsName];
            if (cb) {
                gl.canvas.addEventListener(eventName, function (e) { cb(appContext, e); });
            }
        }

        const appContext = (opts.init || defaultInit)(gl);

        registerCallback('mouseDown', 'mousedown');
        registerCallback('mouseUp', 'mouseup');
        registerCallback('mouseMove', 'mousemove');
        registerCallback('mouseLeave', 'mouseleave');
        registerCallback('wheel', 'wheel');
        registerCallback('touchStart', 'touchstart');
        registerCallback('touchMove', 'touchmove');
        registerCallback('touchEnd', 'touchend');
        registerCallback('touchCancel', 'touchcancel');

        function render(time) {
            twgl.resizeCanvasToDisplaySize(gl.canvas);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            (opts.render || defaultRender)(gl, appContext, time);

            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);

        return { context: appContext };
    }

    window.webGlKit = {
        create: createKit,
        createMousePanZoomController: createMousePanZoomController,
        createTouchPanZoomController: createTouchPanZoomController
    };
})();