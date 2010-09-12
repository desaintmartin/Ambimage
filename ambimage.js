/**
 * @author Cedric de Saint Martin 
 * This is a fork from Sergey Chikuyonok's Ambilight for images.
 */
var ambimage = (function() {

var default_settings = {
  brightness: 12.7,
  saturation: 1.4,
  lamps: 5,
  block_size: 40,
  fade_time: 400
};

var buffer = document.createElement('canvas'),
    buffer_ctx = buffer.getContext('2d'),
    play_list = [],
    light_cache = {},
    _id = 0;



/**
 * Generate unique ID for image element
 * @return {String}
 */
function getId() {
  return 'ambi__id' + (_id++);
}


/**
 * Returns internal ID for image element, if it has it
 * @param {Element} elem image element
 * @return {String|null}
 */
function getIdByImage(elem) {
  for (var p in light_cache) if (light_cache.hasOwnProperty(p))
    if (light_cache[p].image == elem)
      return p;
      
  return null;
}


/**
 * Prepares image element for ambilight: creates canvases for lights and
 * caches it
 * @param {Element} elem image element
 */
function prepareImage(elem) {
  var id = getIdByImage(elem);
  
  if (id === null) {
    id = getId();
    light_cache[id] = {
      image: elem
    };
  }
  
  return id;
}

/**
 * Returns ambilight assets object for image ID
 * @return {Object}
 */
function getAssets(id) {
  return light_cache[id];
}

  /**
   * Makes current frame snapshot in buffer canvas
   * @param {String} id Internal video's ID
   */
  function createSnapshot(id) {
    var assets = getAssets(id),
        image = assets.image;

    buffer.width = image.width;
    buffer.height = image.height;

    buffer_ctx.drawImage(image, 0, 0, buffer.width, buffer.height);
  }


/**
 * Calculates middle color for pixel block
 * @param {CanvasPixelArray} data Canvas pixel data
 * @param {Number} from Start index of pixel data
 * @param {Number} to End index of pixel data
 * @return {Array} RGB-color
 */
function calcMidColor(data, from, to) {
  var j = 0;
  for (i = 0; i<data.length; i++) {
  if (data[i] !== 0) {
    j++
  }
  }
  var result = [0, 0, 0];
  var total_pixels = (to - from) / 4;

  for (var i = from; i <= to; i += 4) {
    result[0] += data[i];
    result[1] += data[i + 1];
    result[2] += data[i + 2];
  }

  result[0] = Math.round(result[0] / total_pixels);
  result[1] = Math.round(result[1] / total_pixels);
  result[2] = Math.round(result[2] / total_pixels);

  return result;
}


/**
 * Gets option by its name
 * @return {String|Number}
 */
function getOption(name) {
  return default_settings[name];
}

  /**
 * Returns array of midcolors for one of the side of buffer canvas
 * @param {String} side Canvas side where to take pixels from. 'left' or 'right'
 * @return {Array[]} Array of RGB colors
 */
function getMidColors(side) {
  var w = buffer.width,
    h = buffer.height,
    lamps = getOption('lamps'),
    block_width = getOption('block_size'),
    block_height = Math.ceil(h / lamps),
    pxl = block_width * block_height * 4,
    result = [],
    img_data = buffer_ctx.getImageData(side == 'right' ? w - block_width : 0, 0, block_width, h),
    total_pixels = img_data.data.length;

  for (var i = 0; i < lamps; i++) {
    var from = i * w * block_width;
    result.push( calcMidColor(img_data.data, i * pxl, Math.min((i + 1) * pxl, total_pixels - 1)) );
  }
  return result;
}


/**
 * Convers RGB color to HSV model
 * @param {Number[]} RGB color
 * @return {Number[]} HSV color
 */
function rgb2hsv(color) {
  var r = color[0] / 255,
    g = color[1] / 255,
    b = color[2] / 255;

  var x, val, d1, d2, hue, sat, val;
  
  x = Math.min(Math.min(r, g), b);
  val = Math.max(Math.max(r, g), b);
  if (x == val)
    throw Error('h is undefined');

  d1 = (r == x) ? g-b : ((g == x) ? b-r : r-g);
  d2 = (r == x) ? 3 : ((g == x) ? 5 : 1);

  hue = Math.floor((d2 - d1 / (val - x)) * 60) % 360;
  sat = Math.floor(((val - x) / val) * 100);
  val = Math.floor(val * 100);
  return [hue, sat, val];
}

/**
 * Convers HSV color to RGB model
 * @param {Number[]} RGB color
 * @return {Number[]} HSV color
 */
function hsv2rgb(color) {
  var h = color[0],
    s = color[1],
    v = color[2];

  var r, g, a, b, c, s = s / 100, v = v / 100, h = h / 360;

  if (s > 0) {
    if (h >= 1) h=0;

    h = 6 * h;
    var f = h - Math.floor(h);
    a = Math.round(255 * v * (1 - s));
    b = Math.round(255 * v * (1 - (s * f)));
    c = Math.round(255 * v * (1 - (s * (1 - f))));
    v = Math.round(255 * v);

    switch (Math.floor(h)) {
      case 0: r = v; g = c; b = a; break;
      case 1: r = b; g = v; b = a; break;
      case 2: r = a; g = v; b = c; break;
      case 3: r = a; g = b; b = v; break;
      case 4: r = c; g = a; b = v; break;
      case 5: r = v; g = a; b = b; break;
    }

    return [r || 0, g || 0, b || 0];

  } else {
    v = Math.round(v * 255);
    return [v, v, v];
  }
}

/**
 * Adjusts color lightness and saturation
 * @param {Number[]} RGB color
 * @return {Number[]}
 */
function adjustColor(color) {
  try {
    var _color = rgb2hsv(color);
    _color[1] = Math.min(100, _color[1] * getOption('saturation'));
    _color[2] = Math.min(100, _color[2] * getOption('brightness'));
    return hsv2rgb(_color);
  } catch (e) {
    return color;
  }
}

/**
 * Returns element's CSS dproperty value
 * @param {Element} elem
 * @param {String} name
 */
function getCSS(elem, name) {
  if (document.defaultView && document.defaultView.getComputedStyle) {
    var cs = document.defaultView.getComputedStyle(elem, "");
    return cs && cs.getPropertyValue(name);
  }
}

/**
 * Creates canvas for light element
 * @param {Element} image
 * @param {String} class_name
 * @return {Element}
 */
function createCanvas(image, class_name) {
  var canvas = document.createElement('canvas');
  canvas.style.opacity = '0';
  canvas.className = class_name;
  image.parentNode.appendChild(canvas);
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  return canvas;
}

/**
 * Draw ambilight on one of the image's side
 * @param {String} id Internal image ID
 * @param {String} side On what side draw highlight, 'left' or 'right'
 */
function createLight(id, side) {
  side = (side == 'left') ? 'left' : 'right';
  var assets = getAssets(id);
    
  if (assets['mask-' + side]) {
    if (assets['mask-' + side + '-loaded'])
      drawLight(id, side);
  } else {
    var canvas = createCanvas(assets.image, 'ambilight-' + side);
    var mask_url = getCSS(canvas, 'background-image').replace(/^url\(['"]?|['"]?\)$/g, '');
    var img = new Image;
    img.onload = function() {
      assets['mask-' + side + '-loaded'] = true;
      drawLight(id, side, canvas);
    };
    
    assets['mask-' + side] = img;
    assets['mask-' + side + '-loaded'] = false;
    img.src = mask_url;
  }
}

/**
 * Draws light on one side of image element defined by ID
 * @param {String} id Internal image ID
 * @param {String} side 'left' or 'right'
 */
function drawLight(id, side, canvas) {
  var assets = getAssets(id),
    /** @type {Element} */
    image = assets.image;
  
  if (!canvas)
    canvas = createCanvas(image, 'ambilight-' + side);
    
  /** @type {CanvasRenderingContext2D} */
  var ctx = canvas.getContext('2d');
  
  canvas.style.opacity = '0';
  
  var midcolors = getMidColors(side),
    grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    window.g = grd;
    
  for (var i = 0, il = midcolors.length; i < il; i++) {
    grd.addColorStop(i / il, 'rgb(' + adjustColor(midcolors[i]).join(',') + ')');
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  var img = assets['mask-' + side];
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
  
  // if we have old light, remove it
  var old_light = assets[side];
  $(canvas).animate({opacity: 1}, getOption('fade_time'), 'linear', function() {
    if (old_light)
      old_light.parentNode.removeChild(old_light);
  });
  
  assets[side] = canvas;
}

return {
  drawAmbimage: function(e) {
    var image = document.getElementById("image");
    id = prepareImage(image);
    play_list.push(id);
    createSnapshot(id);
    createLight(id, 'left');
    createLight(id, 'right');
  }
}
})();

function onImageReadyForDrawing(e) {
  var image = e ? e.target : document.getElementById("image"),
      imageWrapper = document.createElement('div');
  imageWrapper.appendChild(image);
  imageWrapper.id = 'image-wrap';
  image.parentNode.setAttribute('style', 'width: ' + image.width + "px");
  document.body.appendChild(imageWrapper);
  //image.setAttribute('class', 'toAnimate animated');
  setTimeout(ambimage.drawAmbimage, 1000);
}

window.addEventListener("load",function() {
  var image = new Image();
  image.id = "image";
  image.addEventListener("load", onImageReadyForDrawing, false);
  image.src = "last.jpg";
  //image.setAttribute('class', 'toAnimate');
},false);