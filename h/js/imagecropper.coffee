class ImageCropper
  loadPicture: (img_url, shapeSelector, container, scale) ->
    r = $.Deferred()
    $("<img/>").attr("src", img_url).load ->
      r.resolve this, shapeSelector, container, scale
    r

  cropImage: (image, shapeSelector, container, scale) ->
    unless shapeSelector? then return
    if shapeSelector.shapeType is 'rect'
      # Convert fraction to pixel
      width = shapeSelector.geometry.width * image.width
      height = shapeSelector.geometry.height * image.height
      x = shapeSelector.geometry.x * image.width
      y = shapeSelector.geometry.y * image.height
      if scale
        ratio = if 75/width < 75/height then 75/width else 75/height
      else ratio = 1

      imgCanvas = document.createElement "canvas"
      imgContext = imgCanvas.getContext "2d"

      imgCanvas.width = width * ratio
      imgCanvas.height = height * ratio
      imgContext.drawImage image, x, y, width, height, 0, 0, width * ratio, height * ratio
      container.append imgCanvas

  createCroppedCanvas: (img_url, shapeSelector, container, scale = false) ->
    @loadPicture(img_url, shapeSelector, container, scale).done(@cropImage)

angular.module('h.imagecropper',['bootstrap'])
    .service('imagecropper', ImageCropper)