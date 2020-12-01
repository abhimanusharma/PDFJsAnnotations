/**
 * PDFAnnotate v1.0.0
 * Author: Ravisha Heshan
 */

import * as PDFJS from 'pdfjs-dist';
import { jsPDF } from "jspdf";
import { fabric } from "fabric";
import Arrow from './arrow.fabric.js';

PDFJS.GlobalWorkerOptions.workerSrc = process.env.MIX_API_URL+'vendor/pdf.worker.js';

let PDFAnnotate = function(container_id, url, options = {}) {
	this.number_of_pages = 0;
	this.pages_rendered = 0;
	this.active_tool = 1; // 1 - Free hand, 2 - Text, 3 - Arrow, 4 - Rectangle
	this.fabricObjects = [];
	this.fabricObjectsData = [];
	this.color = '#212121';
	this.borderColor = '#000000';
	this.borderSize = 1;
	this.font_size = 16;
	this.active_canvas = 0;
	this.container_id = container_id;
	this.url = url;
	this.control = Object;
	var inst = this;

	var loadingTask = PDFJS.getDocument(this.url);
	loadingTask.promise.then(function (pdf) {
	    var scale = 1.8;
	    inst.number_of_pages = pdf.numPages;

	    for (var i = 1; i <= pdf.numPages; i++) {
	        pdf.getPage(i).then(function (page) {
	            var viewport = page.getViewport({scale});
	            var canvas = document.createElement('canvas');
	            document.getElementById(inst.container_id).appendChild(canvas);
	            canvas.className = 'pdf-canvas';
	            canvas.height = viewport.height;
	            canvas.width = viewport.width;
	            var context = canvas.getContext('2d');

	            var renderContext = {
	                canvasContext: context,
	                viewport: viewport
	            };
	            var renderTask = page.render(renderContext);
	            renderTask.promise.then(function () {
					var elements = document.querySelectorAll('.pdf-canvas');
					Array.prototype.forEach.call(elements, function(el, index){
						el.setAttribute('id', 'page-' + (index + 1) + '-canvas');
					});
	                inst.pages_rendered++;
	                if (inst.pages_rendered == inst.number_of_pages) inst.initFabric();
	            });
	        });
	    }
	}, function (reason) {
	    console.error(reason);
	});

	this.initFabric = function () {
		var inst = this;
		var canvasArr = document.querySelectorAll('#' + inst.container_id + ' canvas');
		Array.prototype.forEach.call(canvasArr, function (el, index) {
	        var background = el.toDataURL("image/png");
	        var fabricObj = new fabric.Canvas(el.id, {
	            freeDrawingBrush: {
	                width: 1,
	                color: inst.color
	            }
	        });
			inst.fabricObjects.push(fabricObj);
			if (typeof options.onPageUpdated == 'function') {
				fabricObj.on('object:added', function() {
					var oldValue = Object.assign({}, inst.fabricObjectsData[index]);
					inst.fabricObjectsData[index] = fabricObj.toJSON()
					options.onPageUpdated(index + 1, oldValue, inst.fabricObjectsData[index]) 
				})
			}
			fabricObj.setBackgroundImage(background, fabricObj.renderAll.bind(fabricObj));
			
			fabricObj.upperCanvasEl.addEventListener("click", function (event) {
	            inst.active_canvas = index;
	            inst.fabricClickHandler(event, fabricObj);
			});
			fabricObj.on('after:render', function () {
				inst.fabricObjectsData[index] = fabricObj.toJSON()
				fabricObj.off('after:render')
			})

			if (index === canvasArr.length - 1 && typeof options.ready === 'function') {
				options.ready()
			}
		});
	}

	this.fabricClickHandler = function(event, fabricObj) {
		var inst = this;
	    if (inst.active_tool == 2) {
			var textValue = 'Sample Text';
			if(inst.control){
				if(inst.control.name) {
					textValue = inst.control.name;
				}
				else {
					textValue = inst.control.uniqueId;
				}
			}

	        var text = new fabric.IText(textValue, {
	            left: event.clientX - fabricObj.upperCanvasEl.getBoundingClientRect().left,
	            top: event.clientY - fabricObj.upperCanvasEl.getBoundingClientRect().top,
	            fill: inst.color,
	            fontSize: inst.font_size,
	            selectable: true
	        });
	        fabricObj.add(text);
	        inst.active_tool = 0;
		}
		
		if(inst.active_tool == 5) {
			var imgCanvas = this.__canvas = new fabric.Canvas('c');
			fabric.Object.transparentCorners = true;
			fabric.Object.originX = fabric.Object.prototype.originY = 'center';

			fabric.Canvas.prototype.getAbsoluteCoords = function(object) {

				return {
				  left: object.left + this._offset.left,
				  top: object.top + this._offset.top
				};
			}

			var btn = document.getElementById('signImg');
			event.target.parentNode.appendChild(btn);

			function positionBtn(obj) {
				var absCoords = imgCanvas.getAbsoluteCoords(obj),
				btnWidth  = 200,
				btnHeight  = 60;
				btn.style.position = 'absolute';
			
				// console.log("btn coordinates");
				btn.style.left = (absCoords.left - btnWidth / 2) + 'px'; //console.log(btn.style.left);
				btn.style.top = (absCoords.top - btnHeight / 2) + 'px'; //console.log(btn.style.top);
				btn.style.opacity = 1;
			}

			fabric.Image.fromURL(process.env.MIX_API_URL+'img/signature.png' , function(img) {

				img.set({
					left: event.clientX - fabricObj.upperCanvasEl.getBoundingClientRect().left,
					top: event.clientY - fabricObj.upperCanvasEl.getBoundingClientRect().top,
					angle: 0,
					opacity: 1
				}).scale(0.75)

				//fabricObj.add(img);
				//fabricObj.add(imgCanvas);
				console.log(fabricObj.getObjects());
				
				inst.active_tool = 0;
			
				img.on('moving', function() { positionBtn(img) });
				img.on('scaling', function() { positionBtn(img) });
				positionBtn(img);
			});
		}
	}
}

PDFAnnotate.prototype.enableSelector = function () {
	var inst = this;
	inst.active_tool = 0;
	if (inst.fabricObjects.length > 0) {
		inst.fabricObjects.forEach(function(fabricObj, i){
			fabricObj.isDrawingMode = false;
		});
	}
}

PDFAnnotate.prototype.enablePencil = function () {
	var inst = this;
	inst.active_tool = 1;
	if (inst.fabricObjects.length > 0) {
		inst.fabricObjects.forEach(function(fabricObj, i){
			fabricObj.isDrawingMode = true;
		});
	}
}

PDFAnnotate.prototype.enableAddText = function (control = null) {
	var inst = this;
	inst.active_tool = 2;
	inst.control = control;
	if (inst.fabricObjects.length > 0) {
		inst.fabricObjects.forEach(function(fabricObj, i){
			fabricObj.isDrawingMode = false;
		});
	}
}

PDFAnnotate.prototype.enableRectangle = function () {
	var inst = this;
	var fabricObj = inst.fabricObjects[inst.active_canvas];
	inst.active_tool = 4;
	if (inst.fabricObjects.length > 0) {
		inst.fabricObjects.forEach(function(fabricObj, i){
			fabricObj.isDrawingMode = false;
		});
	}

	var rect = new fabric.Rect({
		width: 100,
		height: 100,
		fill: inst.color,
		stroke: inst.borderColor,
		strokeSize: inst.borderSize
	});
	fabricObj.add(rect);
}

PDFAnnotate.prototype.enableAddArrow = function () {
	var inst = this;
	inst.active_tool = 3;
	if (inst.fabricObjects.length > 0) {
		inst.fabricObjects.forEach(function(fabricObj, index){
			fabricObj.isDrawingMode = false;
	        new Arrow(fabricObj, inst.color, function () {
	            inst.active_tool = 0;
	        });
		});
	}
}

PDFAnnotate.prototype.setAddSignImg = function() {
	var inst = this;
	
	if (inst.fabricObjects.length > 0) {
		inst.fabricObjects.forEach(function(fabricObj, i){
			inst.active_tool = 5;
			fabricObj.isDrawingMode = false;
		});
	}
}

PDFAnnotate.prototype.deleteSelectedObject = function () {
	var inst = this;
	var activeObject = inst.fabricObjects[inst.active_canvas].getActiveObject();
	if (activeObject)
	{
	    if (confirm('Are you sure ?')) inst.fabricObjects[inst.active_canvas].remove(activeObject);
	}
}

PDFAnnotate.prototype.savePdf = function () {
	var inst = this;
	var doc = new jsPDF();
	inst.fabricObjects.forEach(function(fabricObj, index){
		if (index != 0) {
	        doc.addPage();
	        doc.setPage(index + 1);
	    }
	    doc.addImage(fabricObj.toDataURL(), 'png', 0, 0);
	});
	doc.save('sample.pdf');
}

PDFAnnotate.prototype.setBrushSize = function (size) {
	var inst = this;
	inst.fabricObjects.forEach(function(fabricObj, i){
		fabricObj.freeDrawingBrush.width = size;
	});
}

PDFAnnotate.prototype.setColor = function (color) {
	var inst = this;
	inst.color = color;
	inst.fabricObjects.forEach(function(fabricObj, i){
		fabricObj.freeDrawingBrush.color = color;
	});
}

PDFAnnotate.prototype.setBorderColor = function (color) {
	var inst = this;
	inst.borderColor = color;
}

PDFAnnotate.prototype.setFontSize = function (size) {
	this.font_size = size;
}

PDFAnnotate.prototype.setBorderSize = function (size) {
	this.borderSize = size;
}

PDFAnnotate.prototype.clearActivePage = function () {
	var inst = this;
	var fabricObj = inst.fabricObjects[inst.active_canvas];
	var bg = fabricObj.backgroundImage;
	if (confirm('Are you sure?')) {
	    fabricObj.clear();
	    fabricObj.setBackgroundImage(bg, fabricObj.renderAll.bind(fabricObj));
	}
}

PDFAnnotate.prototype.serializePdf = function() {
	var inst = this;
	return JSON.stringify(inst.fabricObjects, null, 4);
}

PDFAnnotate.prototype.addSignature = function(image) {
	var inst = this;
	var fabricObj = inst.fabricObjects[inst.active_canvas];

	if (inst.fabricObjects.length > 0) {
		inst.fabricObjects.forEach(function(fabricObj, i){
			fabricObj.isDrawingMode = false;
		});
	}

	console.log(fabricObj.backgroundImage); return;

		fabric.Image.fromURL(image.src, function(imgObj) {
			//i create an extra var for to change some image properties
			var img = imgObj.set({ 
				left: image.xAxis,
				top: image.yAxis,
				//width: '250px',
				//height: '150px'
				});
			fabricObj.add(img);
		});

}

PDFAnnotate.prototype.loadFromJSON = function(jsonData) {
	var inst = this;
	inst.fabricObjects.forEach(function(fabricObj, index){
		if (jsonData.length > index) {
			fabricObj.loadFromJSON(jsonData[index], function () {
				inst.fabricObjectsData[index] = fabricObj.toJSON()
			})
		}
	});
}

export default PDFAnnotate;
