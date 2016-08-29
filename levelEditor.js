

function createWorker(categoryJSON){
  var worker = {};
  worker.canvas = new fabric.Canvas('myCanvas', { selection: true, stateful: false});
  worker.drawData = {};
  worker.objectTypeGenerators = {};
  worker.toolDropMap = {}; //Maps from a subcategory name to its index in drawData[selection].img
  worker.debug = function(canvasObject){
    console.log("Index in state: " + worker.state[canvasObject.categoryType].indexOf(canvasObject));
    console.log("Index in Z levels: " + worker.canvas.getObjects().indexOf(canvasObject));
    console.log("----");
  }


  /******************************************************
  Call this function EVERY TIME we load in a new file!
  ******************************************************/
  worker.refresh = function(){
    //initialize all of the variables we need to start things off
    worker.setDrawingMode(false);
    worker.desiredState = {};
    worker.groupContents = [];
    worker.mousePosition = { "pageX": 0,
                             "pageY": 0};
    worker.grid = 32; //size of a meter in pixels
    worker.tileWidth = 128; //width of a tile in pixels
    worker.tileHeight = 128; // height of a tile in pixels
    worker.gridLines = []; //grid lines
    worker.worldWidth = 64; //width of the world in meters
    worker.worldHeight = 48; //height of the world in meters
    worker.zLevels = {
      "ForegroundLayers": 3,
      "BackgroundLayers": -2,
      "BackgroundAestheticDetails": -1,
      "ForegroundAestheticDetails": 2,
      "Portals": 1, 
    };

    worker.defaultSelectPrompt = "Select an Object";
    worker.imageCount = {}; //Create a mapping from image names to the occurance of their names. Used for tool selection.
    worker.zCounts = {
      "-2": 0,
      "-1": 0,
       "0": 0,
       "1": 0,
       "2": 0,
       "3": 0
    };
    worker.shouldSnapToGrid = function(){
      return $("#snapToGrid").is(":checked");
    }
    //["Spawners", "EnvironmentTiles"];
    worker.hoverImage = null;
    /*
    The hoverImage object has the form:
    {
      'src': 'someimage.png',
      'canvasElement': fabricJSObject,
      'type': "layer" // this should be a category type
    }

    */
    // A list of valid image objects that give the name and location of an image.
    worker.tools = []; 
    worker.state = {
                      "ForegroundLayers": [],
                      "BackgroundLayers": [],
                      "BackgroundAestheticDetails": [],
                      "ForegroundAestheticDetails": [],
                      "AnimatedDetails" : [],
                      "EnvironmentTiles": [],
                      "Avatar": null,
                      "Nodes": [],
                      "Spawners": [],
                      "Turrets": [],
                      "Enemies": [],
                      "Goal": null,
                      "Hazards": [],
                      "Portals": [],
                      "CheckPoints": []
                   };


    worker.selectDropMap = {}; //Maps from a subcategory name to its 

    //Clear the canvas!
    worker.canvas.clear().renderAll();
    worker.drawHideToggles();
    worker.updateWorldWidth(worker.worldWidth);
    worker.updateWorldHeight(worker.worldHeight, true);
    $("#categorySelect").change();
  }
  
  //Bashes the old avatar state with the new avatar location. We assume there was no previous avatar spawn point.

  // PHIL
  worker.setDrawingMode = function(state){
    worker.canvas.isDrawingMode = state;
    if(worker.canvas.isDrawingMode){
      $("#drawing-mode").html("Drawing Mode: ON");
      $("#drawing-mode").addClass("drawing-mode-on");
    }
    else{
      $("#drawing-mode").html("Drawing Mode: OFF");
      $("#drawing-mode").removeClass("drawing-mode-on");
    }
  };

  //Use this function to update the outputObject for Inari
  worker.setLocation = function(canvasObject, group){
    var zLevel = worker.getZLevel(canvasObject);
    //Check if isGrouped, then only modify the correct properties
    if(group){
      var left = group.left  + canvasObject.left + (group.width/2);
      var top = group.top + canvasObject.top + (group.height/2);
      var fakeCanvasObject = {};
      fakeCanvasObject.width = canvasObject.width;
      fakeCanvasObject.height = canvasObject.height;
      fakeCanvasObject.left = left;
      fakeCanvasObject.top = top;
      if(zLevel != 0){
        //Leave them as raw pixel values
        canvasObject.outputObject.Location = worker.getPixelLocationFromCanvasObject(fakeCanvasObject);
      }
      else{
        //convert to meters
        canvasObject.outputObject.Location = worker.getMeterLocationFromCanvasObject(fakeCanvasObject);
      }
    }
    else{
      if(worker.shouldSnapToGrid()){
        canvasObject.set({
          left: Math.round(canvasObject.left / worker.grid) * worker.grid,
          top: Math.round(canvasObject.top / worker.grid) * worker.grid
        });
        canvasObject.setCoords();
        worker.canvas.renderAll();
      }
      if(zLevel != 0){
        //Leave them as raw pixel values
        canvasObject.outputObject.Location = worker.getPixelLocationFromCanvasObject(canvasObject);
      }
      else{
        //convert to meters
        canvasObject.outputObject.Location = worker.getMeterLocationFromCanvasObject(canvasObject);
      }
      if(worker.canvas.getActiveObject() == canvasObject){
        $("#inari_Location_X").val(canvasObject.outputObject.Location.X);
        $("#inari_Location_Y").val(canvasObject.outputObject.Location.Y);
      }
    }
  }

  //Use this function to update the drawing on the canvas
  worker.updateLocation = function(canvasObject){
    var zLevel = worker.getZLevel(canvasObject);
    if(zLevel != 0){
      //We're translating from pixel values
      newLocation = worker.getCanvasLocationFromPixelLocation(canvasObject.outputObject.Location, canvasObject);
      canvasObject.left = newLocation.left;
      canvasObject.top  = newLocation.top;
    }
    else{
      //We're translating from meters
      newLocation = worker.getCanvasLocationFromMeterLocation(canvasObject.outputObject.Location, canvasObject);
      canvasObject.left = newLocation.left;
      canvasObject.top  = newLocation.top;
    }
    if(worker.shouldSnapToGrid()){
      //Update the text boxes
      worker.setLocation(canvasObject);
    }
    else{
      canvasObject.setCoords();
      worker.canvas.renderAll();
    }
  }

  worker.generateDefaultObject = function(canvasObject){
    output = {}
    if(worker.objectTypeGenerators.hasOwnProperty(canvasObject.categoryType)){
      output = worker.objectTypeGenerators[canvasObject.categoryType](canvasObject);
    }
    return output;
  }

  worker.generateDropDownID = function(imgString){
    //Assume the file extension is always .*** = 4 characters
    key = imgString.slice(0, -4)
    if(!worker.imageCount.hasOwnProperty(key)){
      worker.imageCount[key] = 0;
    }
    return key + worker.imageCount[key];
  }

  worker.updateDropDownID = function(imgString){
    key = imgString.slice(0, -4);
    if(worker.imageCount.hasOwnProperty(key)){
      worker.imageCount[key] += 1;
    }
    else{
      worker.imageCount[key] = 0;
    }
  }

  worker.moveDownZLevel = function(canvasObject){
    currentPosition = worker.canvas.getObjects().indexOf(canvasObject);
    zLevel = worker.getZLevel(canvasObject);
    positions = 0;
    //positions += worker.gridLines.length;
    for(var key in worker.zCounts){
      if(key < zLevel && worker.zCounts.hasOwnProperty(String(key))){
        positions += worker.zCounts[String(key)];
      }
    }
    if(positions < currentPosition && zLevel!=0){
      worker.canvas.moveTo(canvasObject, currentPosition-1);
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        worker.arraySwap(worker.state[canvasObject.categoryType], currentPosition-positions, currentPosition - positions -1);
      }
    }
  }

  worker.moveUpZLevel = function(canvasObject){
    var currentPosition = worker.canvas.getObjects().indexOf(canvasObject);
    var zLevel = worker.getZLevel(canvasObject);
    var positions = -1;
    //positions += worker.gridLines.length;
    for(var key in worker.zCounts){
      if(key <= zLevel && worker.zCounts.hasOwnProperty(String(key))){
        positions += worker.zCounts[String(key)];
      }
    }
    if(positions > currentPosition && zLevel!=0){
      worker.canvas.moveTo(canvasObject, currentPosition+1);
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        worker.arraySwap(worker.state[canvasObject.categoryType], (worker.zCounts[zLevel] -1 - (positions - 1 - currentPosition)), (worker.zCounts[zLevel] -1 - (positions - currentPosition)));
      }
    }
  }

  worker.arraySwap = function(targetArray, indA, indB){
    temp = targetArray[indA];
    targetArray[indA] = targetArray[indB];
    targetArray[indB] = temp;
  }

  worker.getZLevel = function(canvasObject){
    return worker.getZLevelFromCategory(canvasObject.categoryType);
  }

  worker.getZLevelFromCategory = function(category){
    if(worker.zLevels.hasOwnProperty(category)){
      return worker.zLevels[category];
    }
    else{
      return 0;
    }
  }

  worker.removeObject = function(canvasObject){
    worker.canvas.remove(canvasObject);
    var zLevel = worker.getZLevel(canvasObject);
    if(Object.prototype.toString.call( worker.state[canvasObject.categoryType] ) === "[object Array]"){
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        var targetIndex = worker.state[canvasObject.categoryType].indexOf(canvasObject);
        if(targetIndex>-1){
          worker.state[canvasObject.categoryType].splice(targetIndex, 1);
          if(worker.zCounts.hasOwnProperty(String(zLevel))){
            worker.zCounts[String(zLevel)] -=1;
          }
        }
      }
    }
    else{
      if(worker.state.hasOwnProperty(canvasObject.categoryType)){
        if(worker.zCounts.hasOwnProperty(String(zLevel))){
            worker.zCounts[String(zLevel)] -=1;
        }
        worker.state[canvasObject.categoryType] = null;
      }

    }
  }

  worker.addObject = function(canvasObject){
    var zLevel = worker.getZLevel(canvasObject);
    if(worker.state.hasOwnProperty(canvasObject.categoryType)){
      //canvasObject.outputObject = worker.generateDefaulfObject(canvasObject);
      var positions = 0;
      //positions += worker.gridLines.length;
      for(var key in worker.zCounts){
        if(key <= zLevel && worker.zCounts.hasOwnProperty(String(key))){
          positions += worker.zCounts[String(key)];
        }
      }
      if(Object.prototype.toString.call( worker.state[canvasObject.categoryType] ) === "[object Array]"){
        worker.state[canvasObject.categoryType].push(canvasObject);
        if(worker.zCounts.hasOwnProperty(String(zLevel))){
          worker.zCounts[String(zLevel)] +=1;
        }
      }
      else{
        if(worker.zCounts.hasOwnProperty(String(zLevel)) && !worker.state[canvasObject.categoryType]){
          worker.zCounts[String(zLevel)] +=1;
        }
        else{
          console.log("REMOVE!");
          worker.canvas.remove(worker.state[canvasObject.categoryType]);
        }
        worker.state[canvasObject.categoryType] = canvasObject;
      }
      //console.log("Move to: " + positions);
      worker.canvas.moveTo(canvasObject, positions);
    }
  }

  worker.addDynamicImage = function(src, categoryType, x, y){
    var oldDrawingMode = worker.canvas.isDrawingMode;
    worker.canvas.isDrawingMode = false;
    fabric.Image.fromURL(src, function(oImg){
          oImg.dropDownID = worker.generateDropDownID(src);
          oImg.imgSource = src;
          oImg.categoryType = categoryType;
          oImg.lockScalingX = true; //make it so we cannot resize the images
          oImg.lockScalingY = true;
          oImg.outputObject = worker.generateDefaultObject(oImg);
          oImg.left = x;//worker.shouldSnapToGrid() ? worker.snapToGrid(x) : x;
          oImg.top = y;//worker.shouldSnapToGrid() ? worker.snapToGrid(y) : y;
          if(oImg.outputObject.hasOwnProperty("PlistSource")){
            worker.updatePList(oImg.outputObject.PlistSource, oImg);
          }
          worker.canvas.add(oImg);
          worker.addObject(oImg);
          worker.setLocation(oImg);
        }); 
    worker.canvas.isDrawingMode = oldDrawingMode;
  }

  worker.redrawSelection = function(){
    fabric.Image.fromURL(worker.hoverImage.src, function(oImg){
          oImg.dropDownID = worker.generateDropDownID(worker.hoverImage.src);
          oImg.imgSource = worker.hoverImage.src;
          oImg.categoryType = worker.hoverImage.type;
          oImg.lockScalingX = true; //make it so we cannot resize the images
          oImg.lockScalingY = true;
          worker.hoverImage.canvasElement = oImg;
          oImg.outputObject = worker.generateDefaultObject(oImg);
          //worker.setLocation(oImg);
          if(oImg.outputObject.hasOwnProperty("PlistSource")){
            worker.updatePList(oImg.outputObject.PlistSource, oImg);
          }
          worker.canvas.add(oImg); 
          worker.drawOnMouseMove(worker.mousePosition);
        }); 
  }

  worker.updateSelectDropDown = function(canvasObject){
    $("#categorySelect").val(canvasObject.categoryType).change();
    $("#subcategorySelect").val(canvasObject.dropDownID).change();
  }

  worker.createPathString = function(pathArray){
    var output = "";
    for (var i = 0; i < pathArray.length; i++){
      for (var ind = 0; ind < pathArray[i].length; ind++){
        output += " " + pathArray[i][ind];
      }
    }
    return output + " z";
  }

  worker.createPathObject = function(pathArray){
    var pathString = worker.createPathString(pathArray);
    var outputPath =document.createElementNS("http://www.w3.org/2000/svg", 'path');
    outputPath.setAttribute("d", pathString);
    return new Path(outputPath);
  }

  worker.createPathForLine = function(x1, y1, x2, y2){
    var pathString = "M " + x1 + " " + y1 + " L " + x2 + " " + y2;
    var outputPath =document.createElementNS("http://www.w3.org/2000/svg", 'path');
    outputPath.setAttribute("d", pathString);
    return new Path(outputPath);
  }

  worker.createLineSegments = function(pathArray){
    var MINDELTA = .01;
    var needNext = false;
    var tempSegment = false;
    var lineSegments = [];
    for (var i = 0; i < pathArray.length; i++){
      var pathElement = pathArray[i];
      if(needNext && pathElement.length >= 3){
        needNext = false;
        var segment = worker.createLineSegment(tempSegment.x1, tempSegment.y1, pathElement[1], pathElement[2]);
        if(worker.isValidSegment(segment)){
          lineSegments.push(segment);
        }
      }
      if(pathElement.length == 3){
        needNext = true;
        tempSegment = worker.createLineSegment(pathElement[1], pathElement[2], 0, 0);
      }
      if(pathElement.length == 5){
        var segment = worker.createLineSegment(pathElement[1], pathElement[2],pathElement[3], pathElement[4]);
        if(worker.isValidSegment(segment)){
          lineSegments.push(segment);
        }
      }
    }
    //Check to see if we need to add a  
    if(lineSegments.length > 0){
      if(needNext){
        var segment = worker.createLineSegment(tempSegment.x1, tempSegment.y1, lineSegments[0]["x1"], lineSegments[0]["y1"]);
        if(worker.isValidSegment(segment)){
          lineSegments.push(segment);
        }
      }
      else{
        var segment =worker.createLineSegment(lineSegments[lineSegments.length-1]["x2"], lineSegments[lineSegments.length-1]["y2"], lineSegments[0]["x1"], lineSegments[0]["y1"]);
        if(worker.isValidSegment(segment)){
          lineSegments.push(segment);
        }
      }
    }
    return lineSegments;
  }

  worker.isValidRectangle = function(cornerArray, lineSegmentsArray){

  }

  worker.hasIntersection = function(ray, lineSegment){
    var minRx = Math.min(ray.x1, ray.x2);
    var maxRx = Math.max(ray.x1, ray.x2);
    var minRy = Math.min(ray.y1, ray.y2);
    var maxRy = Math.max(ray.y1, ray.y2);

    var minLx = Math.min(lineSegment.x1, lineSegment.x2);
    var maxLx = Math.max(lineSegment.x1, lineSegment.x2);
    var minLy = Math.min(lineSegment.y1, lineSegment.y2);
    var maxLy = Math.max(lineSegment.y1, lineSegment.y2);

    var domainMin = Math.max(minRx, minLx);
    var domainMax = Math.min(maxRx, maxLx);

    var rangeMin = Math.max(minRy, minLy);
    var rangeMax = Math.min(maxRy, maxLy);

    return domainMax >= domainMin && rangeMin <= rangeMax;

  }
  worker.isVerticalLine = function(lineSegment){
    return lineSegment.x1 === lineSegment.x2;
  }
  worker.isHorizontalLine = function(lineSegment){
    return lineSegment.y1 === lineSegment.y2;
  }

  worker.makePoint = function(x,y){
    return {"x": x, "y":y};
  }

  worker.isValidIntersection = function(ray, lineSegment, pointSet){
    var minRx = Math.min(ray.x1, ray.x2);
    var maxRx = Math.max(ray.x1, ray.x2);
    var minRy = Math.min(ray.y1, ray.y2);
    var maxRy = Math.max(ray.y1, ray.y2);

    var minLx = Math.min(lineSegment.x1, lineSegment.x2);
    var maxLx = Math.max(lineSegment.x1, lineSegment.x2);
    var minLy = Math.min(lineSegment.y1, lineSegment.y2);
    var maxLy = Math.max(lineSegment.y1, lineSegment.y2);

    var aTerm = (ray.y2 - ray.y1) / (ray.x2 - ray.x1);
    var bTerm = (lineSegment.y2 - lineSegment.y1) / (lineSegment.x2 - lineSegment.x1);
    var x;
    if(worker.isVerticalLine(ray) && worker.isVerticalLine(lineSegment)){
      //Both lines are vertical. See if they have the same X value and a valid, overlapping domain.
      var point = worker.makePoint(ray.x1, min(maxLy, maxRy));
      if (ray.x1 === lineSegment.x1 && min(maxLy, maxRy) >= max(minLy, minRy) && !worker.containsTwoDMap(ray.x1, min(maxLy, maxRy), pointSet)){
        worker.updateTwoDMap(ray.x1, min(maxLy, maxRy), true, pointSet);
        return true;
      }
      return false;
    }
    else if (worker.isVerticalLine(lineSegment)){
      //Just the linesegment is vertical
      x = lineSegment.x1;
    }
    else if (worker.isVerticalLine(ray)){
      x = ray.x1;
    }
    else if (aTerm === bTerm){
      //They are otherwise parallel
      var point = worker.makePoint(max(minRx, minLx), min(maxRy, maxLy));
      if(ray.y1 - (aTerm * ray.x1) === lineSegment.y1 - (bTerm * lineSegment.x1) && !worker.containsTwoDMap(max(minRx, minLx), min(maxRy, maxLy), pointSet)){
        worker.updateTwoDMap(max(minRx, minLx), min(maxRy, maxLy), true, pointSet);
        return true;
      }
      return false;
    }
    else{
      x = ((lineSegment.y1 - ray.y1) + (ray.x1 * aTerm) - (lineSegment.x1 * bTerm)) / (aTerm - bTerm);
    }
    var y = (aTerm*(x - ray.x1)) + ray.y1;
    var point = worker.makePoint(x,y);
    if(isNaN(x) || isNaN(y)){
    }
    
    if(worker.isInDomain(lineSegment, x) && worker.isInRange(lineSegment, y) && worker.isInDomain(ray, x) && worker.isInRange(ray, y) && !worker.containsTwoDMap(x, y, pointSet)){
      worker.updateTwoDMap(x, y, true, pointSet);
      return true;
    }
    return false;
  }

  worker.isInsidePolygon = function(x, y, shape){
    var rayPath = worker.createPathForLine(x, y, worker.canvas.width, worker.canvas.height);
    /*
    var ray = worker.createLineSegment(x, y, worker.canvas.width, worker.canvas.height);
    var pointSet = {};
    for (var segmentInd = 0; segmentInd < lineSegmentArray.length; segmentInd++){
      //console.log(worker.isValidIntersection(ray, lineSegmentArray[segmentInd]));
      var validInter = worker.isValidIntersection(ray, lineSegmentArray[segmentInd], pointSet);
    }
    var rayIntersections = 0;
    for (var subObj in pointSet){
      rayIntersections += Object.keys(subObj).length;
    }
    //console.log(rayIntersections);
    if(rayIntersections % 2 === 0){
      console.log("Failed with ray: (" + x + ", " + y + ") (" + worker.canvas.width + ", " + worker.canvas.height + ")");
      console.log(rayIntersections);
      console.log("--------------------------");
    }
    else{
      console.log("Success with ray: (" + x + ", " + y + ") (" + worker.canvas.width + ", " + worker.canvas.height + ")");
      console.log(rayIntersections);
      console.log(lineSegmentArray);
      console.log("--------------------------");
    }
    */
    var intersections = Intersection.intersectShapes(rayPath, shape);
    if(intersections.hasOwnProperty("points")){
      return intersections.points.length % 2 ===1;
    }
    return false;
  }

  worker.isValidTile = function(cornerArray, shape, seenCorners){
    //console.log(seenCorners);
    var validTile = false;
    for (var cornerIndex = 0; cornerIndex < cornerArray.length; cornerIndex++){
      var x = cornerArray[cornerIndex].x;
      var y = cornerArray[cornerIndex].y;
      if(!worker.containsTwoDMap(x, y, seenCorners)){
        worker.updateTwoDMap(x, y, worker.isInsidePolygon(x, y, shape), seenCorners);
        //console.log("Corner: (" + x + ", " + y+") is " + seenCorners[x][y]);
      }
      validTile = validTile || seenCorners[x][y];
    }
    return validTile;
  }

  worker.updateTwoDMap = function(x, y, value, existingMap){
    if(existingMap.hasOwnProperty(x)){
      existingMap[x][y] = value;
    }
    else{
      existingMap[x] = {};
      existingMap[x][y] = value;
    }
  }

  worker.containsTwoDMap = function(x, y, existingMap){
    return existingMap.hasOwnProperty(x) && existingMap[x].hasOwnProperty(y);
  }

  /*
  worker.isValidTile = function(cornerArray, lineSegmentsArray){
    //Corner Array: BL, BR, TL , TR
    var xTR = cornerArray[3].x;
    var xBL = cornerArray[0].x;
    var yTR = cornerArray[3].y;
    var yBL = cornerArray[0].y;
    for (var segmentInd = 0; segmentInd < lineSegmentsArray.length; segmentInd++){
      var segment = lineSegmentsArray[segmentInd];
      //Check condition 1
      var conditionOneArray = [];
      for (var i = 0; i < cornerArray.length; i++){
        var corner = cornerArray[i];
        var conditionOne = ((segment.y2-segment.y1)*corner.x) + ((segment.x1-segment.x2)*corner.y) + ((segment.x2*segment.y1)-(segment.x1*segment.y2));
        if(conditionOne == 0){
          console.log(segment);
          console.log(corner);
          console.log("Condition 1");
          return true;
        }
        else{
          conditionOne = conditionOne > 0;
        }
        conditionOneArray.push(conditionOne);
      }
      var allTrue = true;
      var allFalse = true;
      for (var condInd = 0; condInd < conditionOneArray.length; condInd++){

        allTrue = allTrue && conditionOneArray[condInd];
        allFalse = allFalse && !conditionOneArray[condInd];
      }
      if(!(allTrue || allFalse) ){
        //Keep looking
        if(!(
          (segment.x1 > xTR && segment.x2 > xTR) ||
          (segment.x1 < xBL && segment.x2 < xBL) ||
          (segment.y1 > yTR && segment.y2 > yTR) ||
          (segment.y1 < yBL && segment.y2 < yBL)
          )){
          console.log("--");
          console.log(segment);
          console.log("Condition 2");
          return true;
        }
      }
    }
    return false;
  }
  */

  worker.createLineSegment = function(x1, y1, x2, y2){
    //round them all up to prevent small deltas.
    /*var tmp = {x1: Math.ceil(x1), y1: Math.ceil(y1), x2: Math.ceil(x2), y2: Math.ceil(y2)};
    if(tmp.x1 === tmp.x2){
      tmp.x2 += 1;
    }
    if(tmp.y1 === tmp.y2){
      tmp.y2 += 1;
    }*/
    var tmp = {x1: x1, y1: y1, x2:x2, y2: y2};
    return tmp;
  }

  worker.isValidSegment = function(lineSegment){
    return !(lineSegment.x1 == lineSegment.x2 && lineSegment.y1 == lineSegment.y2);
  }

  worker.isInDomain = function(lineSegment, xValue){
    return xValue >= Math.min(lineSegment.x1, lineSegment.x2) && xValue <= Math.max(lineSegment.x1, lineSegment.x2);
  }
  worker.isInRange = function(lineSegment, yValue){
    return yValue >= Math.min(lineSegment.y1, lineSegment.y2) && yValue <= Math.max(lineSegment.y1, lineSegment.y2);
  }

  worker.generateTileNeighbors = function(validTileSet){
    var neighborMap = {};
    for (var x in validTileSet){
      for (var y in validTileSet[x]){
        var neighbors = {};
        //Iterate over all X values
        for (var xMultiplier = -1; xMultiplier <= 1; xMultiplier++){
          //Iterate over all Y values
          for (var yMultiplier = -1; yMultiplier <= 1; yMultiplier++){
            var neighX = Number(x) + (worker.tileWidth * xMultiplier);
            var neighY = Number(y) + (worker.tileHeight * yMultiplier);
            if(worker.containsTwoDMap(neighX, neighY, validTileSet) && !(xMultiplier==0 && yMultiplier==0)){
              worker.updateTwoDMap(neighX, neighY, true, neighbors);
            }
          }
        }
      worker.updateTwoDMap(x, y, neighbors, neighborMap);
      }
    }
    return neighborMap;
  }

  worker.drawDynamicTiles = function(validTileSet){
    var neighbors = worker.generateTileNeighbors(validTileSet);
    var tileLabelMap = {}; // A map from tile locations to their respective labels
    var edgeLabelMap = {};
    var centerLabelMap = {};
    var prefix = "textures/EnvironmentTiles/Rocky_Shadow/";
    var suffix = ".png";
    var tileClass = "EnvironmentTiles";
    if (worker.hoverImage){
      for (var x in validTileSet){
        for (var y in validTileSet[x]){
          worker.addDynamicImage(worker.hoverImage.src, worker.hoverImage.type, Number(x) - (worker.tileWidth/2), Number(y) - (worker.tileHeight/2));
        }
      }
    }
    else{

      for (var x in validTileSet){
        for (var y in validTileSet[x]){
          var label = "M";
          var curNeigh = worker.quantifyNeighbors(x, y, neighbors[x][y]);
          var sides = [curNeigh.T, curNeigh.R, curNeigh.L, curNeigh.B].filter(function(val){return val;});
          var corners = [curNeigh.TL, curNeigh.TR, curNeigh.BL, curNeigh.BR].filter(function(val){return val;});
          //Check if it's a corner piece
          //Must have exactly 3 neighbors, 2 of which are sides, one of which is a corner


          //THIS LOGIC IS WRONG--FIX ME!!


          if(curNeigh.number >= 3 && curNeigh.number <=6 && sides.length == 2 && corners.length >= 1){
            //We know it's a corner. Which corner is it?
            //We'll just check the sides
            if (curNeigh.T && curNeigh.L){
              label = "C4";
            }
            else if(curNeigh.T && curNeigh.R){
              label = "C3";
            }
            else if(curNeigh.L && curNeigh.B){
              label = "C2";
            }
            else if(curNeigh.R && curNeigh.B){
              label = "C1";
            }
          }
          //Check if we have an edge piece
          else if (curNeigh.number < 8 && sides.length == 3 && corners.length >= 2){
            //We have an edge piece, but which one?
            //We'll check the sides for simplicity
            if(!curNeigh.T){
              label = "S1";
            }
            else if(!curNeigh.B){
              label = "S3";
            }
            else if(!curNeigh.R){
              label = "S2";
            }
            else{
              label = "S4";
            }
          }
          //Check if we have an inverse neighbor
          else if (curNeigh.number == 7 && sides.length == 4 && corners.length == 3){
            //We have an inverse corner, but which one?
            //Check the corners for simplicity
            if (!curNeigh.TL){
              label = "iC4";
            }
            else if(!curNeigh.TR){
              label = "iC3";
            }
            else if(!curNeigh.BL){
              label = "iC2";
            }
            else{
              label = "iC1";
            }
          }
          if(label === "M"){
            worker.updateTwoDMap(x,y, label, centerLabelMap);
          }
          else{
            worker.updateTwoDMap(x, y, label, edgeLabelMap);
          }
          worker.updateTwoDMap(x, y, label, tileLabelMap);
          //worker.addDynamicImage(prefix + label + suffix, "EnvironmentTiles", Number(x) - (worker.tileWidth/2), Number(y) - (worker.tileHeight/2));
        }
      }

      //Select all "bad tiles". Force them to be "M2"
      var madeChange = true;
      while(madeChange){
        var edgeCountMap = {};
        var mostBadEdges = 0;
        madeChange = false;
        for (var x in centerLabelMap){
          for (var y in centerLabelMap[x]){
            if(centerLabelMap[x][y] === "M" && !worker.canShadeCenterTile(x, y, tileLabelMap, centerLabelMap, neighbors, false)){
              var numBadNeighbors = 0;
              for(var Nx in neighbors[x][y]){
                for (var Ny in neighbors[x][y][Nx]){
                  numBadNeighbors = tileLabelMap[Nx][Ny] != "M" ? numBadNeighbors + 1 : numBadNeighbors;
                }
              }
              mostBadEdges = Math.max(mostBadEdges, numBadNeighbors);
              if(!edgeCountMap.hasOwnProperty(numBadNeighbors)){
                edgeCountMap[numBadNeighbors] = [];
              }
              edgeCountMap[numBadNeighbors].push(worker.makePoint(x,y));
              madeChange = true;
              
            }
          }
        }
        if(madeChange){
          for (var ind = 0; ind < edgeCountMap[mostBadEdges].length; ind++){
            var x = edgeCountMap[mostBadEdges][ind].x;
            var y = edgeCountMap[mostBadEdges][ind].y;
            worker.updateTwoDMap(x, y, "M2", tileLabelMap);
            worker.updateTwoDMap(x, y, "M2", centerLabelMap);
          }
        }
      }



      var didChangeTile = true;
      //while(didChangeTile){
        didChangeTile = false;        //Iterate through all of the center pieces until there are none left that we need to change.
        for (var x in centerLabelMap){
          for (var y in centerLabelMap[x]){
            var label = centerLabelMap[x][y];
            var curNeigh = worker.quantifyNeighbors(x, y, neighbors[x][y]);
            var centerNeighbors = worker.classifyNeighborsByCenter(x, y, tileLabelMap, centerLabelMap);
            if(curNeigh.number === 8 && tileLabelMap[x][y] === "M"){

              //check for normal corners
              if(!centerNeighbors.T && !centerNeighbors.L && !centerNeighbors.TL && centerNeighbors.R && centerNeighbors.B && centerNeighbors.BR){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_C1", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_C1", tileLabelMap);
              }
              else if(!centerNeighbors.T && !centerNeighbors.R && !centerNeighbors.TR && centerNeighbors.L && centerNeighbors.B && centerNeighbors.BL){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_C2", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_C2", tileLabelMap);
              }
              else if(!centerNeighbors.B && !centerNeighbors.L && !centerNeighbors.BL && centerNeighbors.R && centerNeighbors.T && centerNeighbors.TR){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_C3", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_C3", tileLabelMap);
              }
              else if(!centerNeighbors.B && !centerNeighbors.R && !centerNeighbors.BR && centerNeighbors.L && centerNeighbors.T && centerNeighbors.TL){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_C4", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_C4", tileLabelMap);
              }
              //Check for inverse corners
              else if(!centerNeighbors.TL && centerNeighbors.number === 7){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_iC4", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_iC4", tileLabelMap);
              }
              else if(!centerNeighbors.TR && centerNeighbors.number === 7){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_iC3", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_iC3", tileLabelMap);
              }
              else if(!centerNeighbors.BL && centerNeighbors.number === 7){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_iC2", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_iC2", tileLabelMap);
              }
              else if(!centerNeighbors.BR && centerNeighbors.number === 7){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_iC1", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_iC1", tileLabelMap);
              }
              //check for edges
              else if( ((!centerNeighbors.TL || !centerNeighbors.TR) && !centerNeighbors.T)
                && centerNeighbors.number === 8 - (!centerNeighbors.TL + !centerNeighbors.T + !centerNeighbors.TR)){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_S1", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_S1", tileLabelMap);
              }
              else if( ((!centerNeighbors.BL || !centerNeighbors.BR) && !centerNeighbors.B)
                && centerNeighbors.number === 8 - (!centerNeighbors.BL + !centerNeighbors.B + !centerNeighbors.BR)){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_S4", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_S4", tileLabelMap);
              }
              else if( ((!centerNeighbors.BL || !centerNeighbors.TL) && !centerNeighbors.L)
                && centerNeighbors.number === 8 - (!centerNeighbors.BL + !centerNeighbors.L + !centerNeighbors.TL)){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_S2", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_S2", tileLabelMap);
              }
              else if( ((!centerNeighbors.BR || !centerNeighbors.TR) && !centerNeighbors.R)
                && centerNeighbors.number === 8 - (!centerNeighbors.BR + !centerNeighbors.R + !centerNeighbors.TR)){
                didChangeTile = true;
                worker.updateTwoDMap(x,y, "M_S3", centerLabelMap);
                worker.updateTwoDMap(x,y, "M_S3", tileLabelMap);
              }
              //Who the hell knows
              else if(centerNeighbors.number < 8){
                //didChangeTile = true;
                worker.updateTwoDMap(x,y, "M2", centerLabelMap);
                worker.updateTwoDMap(x,y, "M2", tileLabelMap);
              }
            } 
          }
        }
      //}
      /*
      //Second pass: label center pieces.
      for (var x in centerLabelMap){
        for (var y in centerLabelMap[x]){
          var label = centerLabelMap[x][y];
          var curNeigh = worker.quantifyNeighbors(x, y, neighbors[x][y]);
          if(curNeigh.number < 8){
            //We might have an odd corner. Let's check:

          } 
        }
      }
    */

      //Draw the tiles!
      for (var x in validTileSet){
        for (var y in validTileSet[x]){
          worker.addDynamicImage(prefix + tileLabelMap[x][y] + suffix, "EnvironmentTiles", Number(x) - (worker.tileWidth/2), Number(y) - (worker.tileHeight/2));
        }
      }
    }
  }

  worker.canShadeCenterTile = function(x, y, tileLabelMap, centerLabelMap, neighborsMap, shouldUpdate){
    var didChangeTile = false;
    var label = centerLabelMap[x][y];
    var curNeigh = worker.quantifyNeighbors(x, y, neighborsMap[x][y]);
    var centerNeighbors = worker.classifyNeighborsByCenter(x, y, tileLabelMap, centerLabelMap);
    if(curNeigh.number === 8 && tileLabelMap[x][y] === "M"){

      //check for normal corners
      if(!centerNeighbors.T && !centerNeighbors.L && !centerNeighbors.TL && centerNeighbors.R && centerNeighbors.B && centerNeighbors.BR){
        didChangeTile = true;
        label = "M_C1";
      }
      else if(!centerNeighbors.T && !centerNeighbors.R && !centerNeighbors.TR && centerNeighbors.L && centerNeighbors.B && centerNeighbors.BL){
        didChangeTile = true;
        label = "M_C2";
      }
      else if(!centerNeighbors.B && !centerNeighbors.L && !centerNeighbors.BL && centerNeighbors.R && centerNeighbors.T && centerNeighbors.TR){
        didChangeTile = true;
        label = "M_C3";
      }
      else if(!centerNeighbors.B && !centerNeighbors.R && !centerNeighbors.BR && centerNeighbors.L && centerNeighbors.T && centerNeighbors.TL){
        didChangeTile = true;
        label = "M_C4";
      }
      //Check for inverse corners
      else if(!centerNeighbors.TL && centerNeighbors.number === 7){
        didChangeTile = true;
        label = "M_iC4";
      }
      else if(!centerNeighbors.TR && centerNeighbors.number === 7){
        didChangeTile = true;
        label = "M_iC3";
      }
      else if(!centerNeighbors.BL && centerNeighbors.number === 7){
        didChangeTile = true;
        label = "M_iC2";
      }
      else if(!centerNeighbors.BR && centerNeighbors.number === 7){
        didChangeTile = true;
        label = "M_iC1";
      }
      //check for edges
      else if( ((!centerNeighbors.TL || !centerNeighbors.TR) && !centerNeighbors.T)
        && centerNeighbors.number === 8 - (!centerNeighbors.TL + !centerNeighbors.T + !centerNeighbors.TR)){
        didChangeTile = true;
        label = "M_S1";
      }
      else if( ((!centerNeighbors.BL || !centerNeighbors.BR) && !centerNeighbors.B)
        && centerNeighbors.number === 8 - (!centerNeighbors.BL + !centerNeighbors.B + !centerNeighbors.BR)){
        didChangeTile = true;
        label = "M_S4";
      }
      else if( ((!centerNeighbors.BL || !centerNeighbors.TL) && !centerNeighbors.L)
        && centerNeighbors.number === 8 - (!centerNeighbors.BL + !centerNeighbors.L + !centerNeighbors.TL)){
        didChangeTile = true;
        label = "M_S2";
      }
      else if( ((!centerNeighbors.BR || !centerNeighbors.TR) && !centerNeighbors.R)
        && centerNeighbors.number === 8 - (!centerNeighbors.BR + !centerNeighbors.R + !centerNeighbors.TR)){
        didChangeTile = true;
        label = "M_S3";
      }
      else if(centerNeighbors.number === 8){
        label = "M";
        didChangeTile = true;
      }
      else if(centerNeighbors.number < 8){
        label = "M2";
      }
    }
    if(shouldUpdate){
      worker.updateTwoDMap(x,y, label, centerLabelMap);
      worker.updateTwoDMap(x,y, label, tileLabelMap);
    }
    return didChangeTile;
    
  }

  worker.classifyNeighborsByCenter = function(x, y, tileLabelMap, centerMap){
    x = Number(x);
    y = Number(y);
    var output = {
      'TL' : worker.containsTwoDMap(x - worker.tileWidth, y - worker.tileHeight, centerMap) && tileLabelMap[x - worker.tileWidth][y - worker.tileHeight]!="M2",
      'T' : worker.containsTwoDMap(x, y - worker.tileHeight, centerMap) && tileLabelMap[x][y - worker.tileHeight]!="M2",
      'TR': worker.containsTwoDMap(x + worker.tileWidth, y - worker.tileHeight, centerMap) && tileLabelMap[x + worker.tileWidth][y - worker.tileHeight]!="M2",
      'R' : worker.containsTwoDMap(x + worker.tileWidth, y, centerMap) && tileLabelMap[x + worker.tileWidth][y]!="M2",
      'L' : worker.containsTwoDMap(x - worker.tileWidth, y, centerMap) && tileLabelMap[x - worker.tileWidth][y]!="M2",
      'BL': worker.containsTwoDMap(x - worker.tileWidth, y + worker.tileHeight, centerMap) && tileLabelMap[x - worker.tileWidth][y + worker.tileHeight]!="M2",
      'B' : worker.containsTwoDMap(x, y + worker.tileHeight, centerMap) && tileLabelMap[x][y + worker.tileHeight]!="M2",
      'BR': worker.containsTwoDMap(x + worker.tileWidth, y + worker.tileHeight, centerMap) && tileLabelMap[x + worker.tileWidth][y + worker.tileHeight]!="M2"
    };
    var numNeighbors = 0;
    for (var i in output){
      numNeighbors = output[i] ? numNeighbors+1 : numNeighbors;
    }
    output["number"] = numNeighbors;
    return output;
  }

  worker.quantifyNeighbors = function(x, y, neighborsMap){
    x = Number(x);
    y = Number(y);
    var output = {
      'TL' : worker.containsTwoDMap(x - worker.tileWidth, y - worker.tileHeight, neighborsMap),
      'T' : worker.containsTwoDMap(x, y - worker.tileHeight, neighborsMap),
      'TR': worker.containsTwoDMap(x + worker.tileWidth, y - worker.tileHeight, neighborsMap),
      'R' : worker.containsTwoDMap(x + worker.tileWidth, y, neighborsMap),
      'L' : worker.containsTwoDMap(x - worker.tileWidth, y, neighborsMap),
      'BL': worker.containsTwoDMap(x - worker.tileWidth, y + worker.tileHeight, neighborsMap),
      'B' : worker.containsTwoDMap(x, y + worker.tileHeight, neighborsMap),
      'BR': worker.containsTwoDMap(x + worker.tileWidth, y + worker.tileHeight, neighborsMap)
    };
    var numNeighbors = 0;
    for (var i in output){
      numNeighbors = output[i] ? numNeighbors+1 : numNeighbors;
    }
    output["number"] = numNeighbors;
    return output;
  }

  worker.initializeCanvasHandlers = function(){

    worker.canvas.on('path:created', function(path) {
      var numObjects = worker.canvas._objects.length;
      var validTileSet = {}
      if(numObjects > 0 && worker.canvas._objects[numObjects-1].hasOwnProperty("path")){
        var targetPath = worker.canvas._objects[numObjects-1];
        var segmentList = worker.createLineSegments(targetPath.path);
        var shape = worker.createPathObject(targetPath.path);
        var minX = worker.canvas.width;
        var maxX = 0;
        var minY = worker.canvas.height;
        var maxY = 0;
        //get the min and max X and Y values
        //Don't look at the same corner twice
        var seenCorners = {};
        for (var segmentInd = 0; segmentInd < segmentList.length; segmentInd++){
          minX = Math.min(Math.min(segmentList[segmentInd].x1, segmentList[segmentInd].x2), minX);
          maxX = Math.max(Math.max(segmentList[segmentInd].x1, segmentList[segmentInd].x2), maxX);
          minY = Math.min(Math.min(segmentList[segmentInd].y1, segmentList[segmentInd].y2), minY);
          maxY = Math.max(Math.max(segmentList[segmentInd].y1, segmentList[segmentInd].y2), maxY);
        }
        var width = maxX - minX;
        var height = maxY - minY;
       
        var numTilesWide = Math.ceil(width / worker.tileWidth);
        var numTileHigh = Math.ceil(height / worker.tileHeight);
        //Create the line segment list
        //var segmentList = worker.createLineSegments(targetPath.path);
        

        //Iterate over the tiles
        for(var tileCol = Math.round(minX); tileCol < maxX; tileCol+= worker.tileWidth){
          for(var tileRow = Math.round(minY); tileRow < maxY; tileRow += worker.tileHeight){
            //For each tile, create all of its corners
            var TL = {x: tileCol, y: (tileRow+worker.tileHeight)};
            var TR = {x: (tileCol+worker.tileWidth), y: (tileRow+worker.tileHeight)};
            var BL = {x: tileCol, y: tileRow };
            var BR = {x: (tileCol+worker.tileWidth), y: tileRow};
            var center = {x: (tileCol + (worker.tileWidth/2)), y: tileRow + (worker.tileHeight/2)};
            if(worker.isValidTile([BL, BR, TL, TR], shape, seenCorners)){
            //if(true){
              //console.log("Valid at x: " + (tileCol) + " y: " + (tileRow));
              worker.updateTwoDMap(center.x, center.y, true, validTileSet);
              //worker.addDynamicImage("textures/EnvironmentTiles/Rocky_Shadow/M_C2.png", "EnvironmentTiles", tileCol, tileRow);
            }
          }
        }
        //Start drawing
        worker.drawDynamicTiles(validTileSet);
        //Check if the tile is valid.
        worker.canvas.remove(targetPath);
      }
    });

    $("#drawing-mode").click(function(){
      worker.setDrawingMode(!worker.canvas.isDrawingMode);
    });

    // PHIL: toggle side bar
    toggleToolSideBar = function() {
      // clear previous animations in queue
      $(".toolWrapper").clearQueue();

      if ($("#toolToggler").hasClass("minimized")) {
        // expand
        $("#arrow").css("border-width", "10px 0px 10px 10px");
        $("#arrow").css("border-color", "transparent transparent transparent #999999");
        $(".toolWrapper").animate({
          right: "0px"
        }, 800);
        $("#toolToggler").removeClass("minimized");
      } else {
        // minimize
        $("#arrow").css("border-width", "10px 10px 10px 0px");
        $("#arrow").css("border-color", "transparent #999999 transparent transparent");
        $(".toolWrapper").animate({
          right: "-30%"
        }, 800);
        $("#toolToggler").addClass("minimized");
      }
    };

    // on click event for toggling side bar
    $("#toolToggler").click(toggleToolSideBar);

    // PHIL: HOTKEYS
    $(document).keyup(function(e) {
      // don't detect key presses on input fields
      if (e.target.nodeName != 'INPUT') {
        if (e.which == 69) { // e for draw mode
          worker.setDrawingMode(!worker.canvas.isDrawingMode);
        } else if (e.which == 81) { // q for snap to grid
          if (worker.shouldSnapToGrid()) {
            $("#snapToGrid").prop("checked", false);
          } else {
            $("#snapToGrid").prop("checked", true);
          }
        } else if (e.which == 82) { // r for toggle sidebar
          toggleToolSideBar();
        }
      }
    });

    // simulate arrow key scroll with WASD
    var keys = {};
    $(document).keydown(function(e) {
      if (e.target.nodeName != 'INPUT') {
        keys[e.which] = true;
      }
    }).keyup(function(e) {
      if (e.target.nodeName != 'INPUT') {
        delete keys[e.which];
      }
    });

    function panLoop() {
      var panDuration = 50; // ms
      var panDistance = "20px"; 

      if (keys[87] && !keys[83] && !keys[68] && !keys[65]) { // w for pan up
        $("#canvas").animate(
          {scrollTop: "-=" + panDistance},
          panDuration, "linear"
        );
      } else if (!keys[87] && keys[83] && !keys[68] && !keys[65]) { // s for pan down
        $("#canvas").animate(
          {scrollTop: "+=" + panDistance},
          panDuration, "linear"
        );
      } else if (!keys[87] && !keys[83] && keys[68] && !keys[65]) { // d for pan right
        $("#canvas").animate(
          {scrollLeft: "+=" + panDistance},
          panDuration, "linear"
        );
      } else if (!keys[87] && !keys[83] && !keys[68] && keys[65]) { // a for pan left
        $("#canvas").animate(
          {scrollLeft: "-=" + panDistance},
          panDuration, "linear"
        );
      } else if (keys[87] && !keys[83] && keys[68] && !keys[65]) { // DIAGONAL: wd for pan up-right
        $("#canvas").animate(
          {scrollTop: "-=" + panDistance, scrollLeft: "+=" + panDistance},
          panDuration, "linear"
        );
      } else if (keys[87] && !keys[83] && !keys[68] && keys[65]) { // DIAGONAL: wa for pan up-left
        $("#canvas").animate(
          {scrollTop: "-=" + panDistance, scrollLeft: "-=" + panDistance},
          panDuration, "linear"
        );
      } else if (!keys[87] && keys[83] && keys[68] && !keys[65]) { // DIAGONAL: sd for pan down-right
        $("#canvas").animate(
          {scrollTop: "+=" + panDistance, scrollLeft: "+=" + panDistance},
          panDuration, "linear"
        );
      } else if (!keys[87] && keys[83] && !keys[68] && keys[65]) { // DIAGONAL: sa for pan down-left
        $("#canvas").animate(
          {scrollTop: "+=" + panDistance, scrollLeft: "-=" + panDistance},
          panDuration, "linear"
        );
      }
      setTimeout(panLoop,panDuration);
    }

    panLoop();

    $('html').keyup(function(e){
      //Check for the delete key
      var selectedObject = worker.canvas.getActiveObject();
      var selectedGroup = worker.canvas.getActiveGroup();
      if(e.keyCode == 46 && selectedObject) {
          worker.removeObject(selectedObject);
          $("#categorySelect").change();
      }
      else if(e.keyCode == 46 && selectedGroup){
          objectList = selectedGroup.getObjects();
          worker.canvas.deactivateAll().renderAll();
          for(var i = 0; i < objectList.length; i++){
            worker.removeObject(objectList[i]);
          }
          $("#categorySelect").change();
      }
      worker.groupContents = [];
    });

    worker.canvas.on('object:moving', function(options) {
      if(options.target._objects){
        worker.groupContents = options.target._objects;
        //Snap the selection to grid
        if(worker.shouldSnapToGrid()){
          options.target.set({
            left: Math.round(options.target.left / worker.grid) * worker.grid,
            top: Math.round(options.target.top / worker.grid) * worker.grid
          });
        }
        for(var i = 0; i<options.target._objects.length; i++){
          worker.setLocation(options.target._objects[i], options.target);
        }
      }
      else{
        worker.setLocation(options.target);
      }
    });

    worker.canvas.on('object:selected', function(options) {
      var selectedObject = worker.canvas.getActiveObject();
      var selectedGroup = worker.canvas.getActiveGroup();
      if(selectedObject){
        //This means that only one object is selected rather than a group
        if(worker.hoverImage){
          //worker.deselect();
          worker.addObject(selectedObject);
          worker.updateDropDownID(selectedObject.imgSource);
          worker.redrawSelection();

        }
        $("#categorySelect").val(selectedObject.categoryType);
        categorySelectRedraw();
        
        //$("#categorySelect").change();
        $("#subcategorySelect").val(selectedObject.dropDownID);
        //$("#subcategorySelect").change();
        worker.drawSelection();
      }
      else if(selectedGroup){

      }
        
    });


    worker.canvas.on('selection:cleared', function(options) {
      if(worker.shouldSnapToGrid() && worker.groupContents.length > 0){
        for(var i = 0; i<worker.groupContents.length; i++){
          worker.groupContents[i].set({
            left: Math.round(worker.groupContents[i].left / worker.grid) * worker.grid,
            top: Math.round(worker.groupContents[i].top / worker.grid) * worker.grid
          });
          worker.setLocation(worker.groupContents[i]);
        }
      }
      worker.groupContents = [];    
        
      $("#categorySelect").change();
    });

    $("#canvas").mouseleave(function(){
      if (worker.hoverImage){
        worker.canvas.remove(worker.hoverImage.canvasElement);
        worker.hoverImage.canvasElement = null;
      }
    });
    $("#canvas").mouseenter(function(){
      if(worker.hoverImage){
        worker.redrawSelection();
      }
    });

    $("#canvas").mousemove(function(e){
      worker.mousePosition.pageX = e.pageX;
      worker.mousePosition.pageY = e.pageY;
      //Moving the object along with mouse cursor
      worker.drawOnMouseMove(worker.mousePosition);
      });

    /*$("#canvas").click(function(e){
      if(worker.hoverImage){
        worker.deselect();
        var selectedObject = worker.canvas.getActiveObject()
        if(selectedObject){
          console.log("adding");
          worker.addObject(selectedObject);
          worker.updateDropDownID(selectedObject.imgSource);
        }
      }
    });*/

    $("#slider").slider({
      min: 10,
      max: 100,
      value: 100,
      slide: function(event, ui){
        worker.canvas.setZoom(ui.value / 100);
        // PHIL
        $("#zoomTitle").html(ui.value + " %");
      }
    });

    // PHIL: zoom with mousewheel
    $("#canvas").on("mousewheel DOMMouseScroll", function(e) {
      // prevent scrolling
      e.preventDefault();
      var wheelDelta = e.originalEvent.wheelDelta / 24; // 5% increments
      $("#slider").slider("value", $("#slider").slider("value") + wheelDelta);
      // zoom canvas + change UI value
      worker.canvas.setZoom($("#slider").slider("value") / 100);
      $("#zoomTitle").html($("#slider").slider("value") + " %");
    });

   
  }

  worker.initializeWorldControls = function(){
    $("#worldWidth").keyup(function(event){
      if(event.keyCode == 13 && !isNaN(Number($(this).val()))){
        worker.updateWorldWidth(Number($(this).val()));
      }
    });
    $("#worldHeight").keyup(function(event){
      if(event.keyCode == 13 && !isNaN(Number($(this).val()))){
        worker.updateWorldHeight(Number($(this).val()));
      }
    });
  }

  worker.drawOnMouseMove = function(e){
    if (worker.hoverImage && worker.hoverImage.canvasElement) {
          worker.hoverImage.canvasElement.left = ((e.pageX + $('#canvas').scrollLeft() - $('#canvas').offset().left)/worker.canvas.getZoom()) - worker.hoverImage.canvasElement.width /2;
          worker.hoverImage.canvasElement.top = ((e.pageY + $('#canvas').scrollTop() - $('#canvas').offset().top)/ worker.canvas.getZoom()) - worker.hoverImage.canvasElement.height /2 ;
          if(worker.shouldSnapToGrid()){
            worker.hoverImage.canvasElement.left = worker.snapToGrid(worker.hoverImage.canvasElement.left);
            worker.hoverImage.canvasElement.top = worker.snapToGrid(worker.hoverImage.canvasElement.top);
          }
          worker.hoverImage.canvasElement.setCoords();
          if(worker.hoverImage.canvasElement.outputObject){
            if(worker.getZLevel(worker.hoverImage.canvasElement) !=0){
              worker.hoverImage.canvasElement.outputObject.Location = worker.getPixelLocationFromCanvasObject(worker.hoverImage.canvasElement);
            }
            else{
              worker.hoverImage.canvasElement.outputObject.Location = worker.getMeterLocationFromCanvasObject(worker.hoverImage.canvasElement);
            }
          }
          
          worker.canvas.renderAll();
        }
  }

  worker.updateWorldHeight = function(val, repopulating){
    $("#worldHeight").val(val);
    var oldHeight = worker.worldHeight;
    worker.worldHeight = val;
    worker.canvas.setHeight(worker.convertMetersToPixels(val));
    var delta = worker.convertMetersToPixels(val - oldHeight);
    worker.redrawLines();
    //Need to update the Y coordinates of every drawn element
    for(var category in worker.state){
      if(worker.state.hasOwnProperty(category)){
        if(Object.prototype.toString.call( worker.state[category] ) === "[object Array]" && worker.state[category].length > 0){
          for(var i =0; i < worker.state[category].length; i++){
            if(!repopulating){
              worker.state[category][i].top += delta;
            }
            worker.setLocation(worker.state[category][i]);
          }
        }
        else if(Object.prototype.toString.call( worker.state[category] ) === "[object Object]" && worker.state[category]){
          if(!repopulating){
              worker.state[category].top += delta;
          }
          worker.setLocation(worker.state[category]);
        }
      }
    }
  }

  worker.updateWorldWidth = function(val){
    $("#worldWidth").val(val);
    worker.worldWidth = val;
    worker.canvas.setWidth(worker.convertMetersToPixels(val));
    worker.redrawLines();
  }

  worker.redrawLines = function(){
    for (var i = 0; i< worker.gridLines.length; i++){
      worker.canvas.remove(worker.gridLines[i]);
    }
    worker.gridLines = [];
    var height = worker.convertMetersToPixels(worker.worldHeight);
    var width = worker.convertMetersToPixels(worker.worldWidth);
    for (var i = 0; i <= (height / worker.grid); i++) {
      // PHIL
      if (i % 4 == 0) { // every 4th line is darker
        var line = new fabric.Line([ 0, i * worker.grid, width, i * worker.grid], { stroke: '#000', selectable: false, opacity: 0.3 });
      } else {
        var line = new fabric.Line([ 0, i * worker.grid, width, i * worker.grid], { stroke: '#000', selectable: false, opacity: 0.1 });
      }
      worker.gridLines.push(line);
      worker.canvas.add(line);
      line.bringToFront();
    }
    for (var i = 0; i<= (width / worker.grid); i++){
      if (i % 4 == 0) { // every 4th line is darker
        var line = new fabric.Line([ i * worker.grid, 0, i * worker.grid, height], { stroke: '#000', selectable: false, opacity: 0.3 });
      } else {
        var line = new fabric.Line([ i * worker.grid, 0, i * worker.grid, height], { stroke: '#000', selectable: false, opacity: 0.1 });
      }
      worker.gridLines.push(line);
      worker.canvas.add(line);
      line.bringToFront();
    }
  }

  worker.convertMetersToPixels = function(val){
    return val * worker.grid;
  };

  worker.getTypeFromCanvasObject = function(canvasObject){
    return canvasObject.imgSource.slice(0, -4);
  }
  worker.getPixelLocationFromCanvasObject = function(canvasObject){
    //Return the lower left-hand corner of the object
    var location = {};
    location["X"] = canvasObject.left;
    location["Y"] = worker.convertMetersToPixels(worker.worldHeight) - canvasObject.top - canvasObject.height;
    return location;
  }

  worker.getMeterLocationFromCanvasObject = function(canvasObject){
    //Return the lower left-hand corner of the object
    var location = {};
    location["X"] = worker.convertPixelsToMeters(canvasObject.left);
    location["Y"] = worker.worldHeight - worker.convertPixelsToMeters(canvasObject.top + canvasObject.height);
    return location;
  }

  worker.getCanvasLocationFromMeterLocation = function(meterLoc, canvasObject){
    var location = {};
    location["left"] = worker.convertMetersToPixels(meterLoc.X);
    location["top"] = worker.convertMetersToPixels(worker.worldHeight) - worker.convertMetersToPixels(meterLoc.Y) - canvasObject.height;
    return location;
  }

  worker.getCanvasLocationFromPixelLocation = function(pixelLoc, canvasObject){
    var location = {};
    location["left"] = pixelLoc.X;
    location["top"] = worker.convertMetersToPixels(worker.worldHeight) - pixelLoc.Y - canvasObject.height;
    return location;
  }

  worker.convertPixelsToMeters = function(val){
    return val / worker.grid;
  };


  worker.createAvatar = function(canvasObject){
    var avatar = {
                  "Width": canvasObject.width,
                  "Height": canvasObject.height,
                  "PNGSource": canvasObject.imgSource,
                  "Location" : worker.getMeterLocationFromCanvasObject(canvasObject)
                  };
    return avatar;
  };

  worker.createAnimatedDetail = function(canvasObject){
    var detail = {
                "SpriteSheet": canvasObject.imgSource,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
                "GoalLocation": worker.getMeterLocationFromCanvasObject(canvasObject),
                "ShowCheckmark": true,
                "Radius": 0.0,
                "UseRadius": false,
                "InvertRadius": false,
                "LoopAfterCompletion": false,
                "TriggerOnRight": true
    };
    return detail;
  }

  worker.createCheckPoint = function(canvasObject){
    var detail = {
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "DrawDepth" : 1,
    };
    return detail;
  }

  worker.createPortal = function(canvasObject){
    var portal = {
                  "Width": canvasObject.width,
                  "Height" : canvasObject.height,
                  "PNGSource" : canvasObject.imgSource,
                  "Location" : worker.getPixelLocationFromCanvasObject(canvasObject),
                  "DrawDepth" : 1,
                  "LevelTarget" : "levels/leveName.json"
                 };
   return portal;
  };


  worker.createReceptacle = function(canvasObject){
    var receptacle = {
                    "Width" : canvasObject.width,
                    "Height" : canvasObject.height,
                    "PNGSource" : canvasObject.imgSource,
                    "Location" : worker.getMeterLocationFromCanvasObject(canvasObject),
                    "drawDepth" : 0,
                    "targetChild" : {},
                    "active" : false //Active means the wall is down
    };
    Object.defineProperty(receptacle, "targetChild", {
      enumerable: false,
      writable: true
    });
    return receptacle;
  };

  worker.createReceptacleWall = function(canvasObject){
    var wall = worker.createTile(canvasObject);
    wall.targetParent = {};
    Object.defineProperty(wall, "targetParent", {
      enumerable: false,
      writable: true
    });
    return wall;
  };

  worker.createGoal = function(canvasObject){
    var goal = {
                  "PNGSource": canvasObject.imgSource,
                  "Width": canvasObject.width,
                  "Height": canvasObject.height,
                  "Location": worker.getMeterLocationFromCanvasObject(canvasObject)
                  };
    return goal;
  }

  worker.createBackgroundAestheticDetail = function(canvasObject){
    var detail = {
                "DrawDepth": -1,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
    };
    return detail;
  }

  worker.createForegroundAestheticDetail = function(canvasObject){
    var detail = {
                "DrawDepth": 1,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
    };
    return detail;
  }

  worker.createSpawner = function(canvasObject){
    newSpawner = {
                "PNGSource": canvasObject.imgSource,
                "PlistSource": worker.imgToPlist(canvasObject.imgSource),
                "Type": worker.getTypeFromCanvasObject(canvasObject),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Boundable": false,
                "Collidable": true,
                "ObeysPhysics": true,
                "Velocity": {
                              "X": 0,
                              "Y": 0
                            },
                "Fancy": false,
                "Delay": 0,
                "TimeBetweenShots": 60,
                "Angle": 0,
                "flipHorizontal": false,
                "flipVertical" : false
    };
    return newSpawner;
  };

  worker.createTurret = function(canvasObject){
    newTurret = {
                "PNGSource": canvasObject.imgSource,
                "Type": worker.getTypeFromCanvasObject(canvasObject),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "ProjectileSpeed": 5,
                "Delay": 0,
                "TimeBetweenShots": 60,
                "Angle": 90
    };
    return newTurret;
  };

  worker.createEnemy = function(canvasObject){
    newEnemy = {
                "PNGSource": canvasObject.imgSource,
                "Type":  worker.getTypeFromCanvasObject(canvasObject),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Boundable": false,
                "Collidable": true,
                "ObeysPhysics": true,
                "Velocity": {
                              "X": 0,
                              "Y": 0
                            },
                "MaxVelocity": {
                              "X": 0,
                              "Y": 0
                            }
    };
    return newEnemy;
  };

  worker.createBackgroundLayer = function(canvasObject){
    newLayer = {
                "DrawDepth": -2,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
                "ParallaxRates": {
                  "X": 0.0,
                  "Y": 0.0}
    };
    return newLayer;
  };

  worker.createForegroundLayer = function(canvasObject){
    newLayer = {
                "DrawDepth": 2,
                "PNGSource": canvasObject.imgSource,
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getPixelLocationFromCanvasObject(canvasObject),
                "ParallaxRates": {
                  "X": 0.0,
                  "Y": 0.0}
    };
    return newLayer;
  };

  worker.createHazard = function(canvasObject){
    newHazard = {
      "PNGSource": canvasObject.imgSource,
      "PlistSource": worker.imgToPlist(canvasObject.imgSource),
      "Type" : worker.getTypeFromCanvasObject(canvasObject),
      "Width": canvasObject.width,
      "Height": canvasObject.height,
      "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
      "Boundable": false,
      "ObeysPhysics": true
    }
    return newHazard;
  }

  worker.createNode = function(canvasObject){
    newNode = {
                "PNGSource": canvasObject.imgSource,
                "Type":  worker.getTypeFromCanvasObject(canvasObject),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Boundable": true,
                "Collidable": false,
                "ObeysPhysics": false,
                "EndLocation": {
                              "X": 0,
                              "Y": 0
                            },
                "Moves": false,
                "Velocity": 1.0
    };
    return newNode;
  }
  worker.imgToPlist = function(imgSrc){
    var splitList = imgSrc.split("/");
    var newSrc = splitList[splitList.length-1];
    var dot = newSrc.indexOf('.');
    return "/plists/" + newSrc.slice(0, dot) + ".json";
  }

  worker.createTile = function(canvasObject){
    newTile = {
                "PNGSource": canvasObject.imgSource,
                "PlistSource": worker.imgToPlist(canvasObject.imgSource),
                "Width": canvasObject.width,
                "Height": canvasObject.height,
                "Location": worker.getMeterLocationFromCanvasObject(canvasObject),
                "Breakable": false
    };
    return newTile;
  };

  worker.removeTile = function(tileObject){
    this.genericRemoveItemFromList(this.state.EnvironmentTiles, tileObject);
  }
  //This on removes a layer from the list passed in. This does NOT modify the canvas. 
  worker.removeLayer = function(removalList, layerObject){
    this.genericRemoveItemFromList(removalList, layerObject);
  };

  //A simple method for removing items from lists
  worker.genericRemoveItemFromList = function(removalList, itemToRemove){
    targetIndex = removalList.indexOf(itemToRemove); 
    if(targetIndex > -1){
      //Remove the element from the list in place.
      removalList.splice(targetIndex, 1);
    }
  };

  worker.addToDropDown = function(dropDownID, newValue){
    $(dropDownID).append('<option value="' + newValue +'">' + newValue + '</option>');
  };

  worker.removeFromDropDown = function(dropDownID, oldValue){
    $(dropDownID + " option[value='" + oldValue + "']").remove();
  };

  worker.removeAllOptions = function(dropDownID){
    $(dropDownID)
    .find('option')
    .remove()
  };

  worker.addChangeHandler = function(targetID, closure){
    $(targetID).change(closure);
  };

  worker.drawTools = function(){
      $(".toolPopulateCanvas").remove();
      if(worker.tools.length > 0){
        var main = $(document.createElement('div')).addClass("toolPopulateCanvas");
        
        for(var ind = 0; ind<worker.tools.length; ind++){
          // latestTile = $(document.createElement('div')).addClass("selectable").append("<img class='image' src=" + worker.tools[ind]  + ">");
          // PHIL
          var pos = worker.tools[ind].toString().lastIndexOf("/");
          var overlayText = worker.tools[ind].toString().substring(pos+1, worker.tools[ind].toString().length-4);
          latestTile = $(document.createElement('div')).addClass("selectable").append("<img class='image' src=" + worker.tools[ind]  + ">" + "<div class='overlay'>" + overlayText + "</div>");
          tileClickHandler(latestTile);
          main.append(latestTile);
        }
        $(".toolPopulate").append(main);
      }
      
    };

  worker.drawHideToggles = function(){
    $(".toggleVisibility").remove();
    var main = $(document.createElement('div')).addClass("toggleVisibility");
      for(var name in worker.state){
        if(worker.state.hasOwnProperty(name)){
          var toggleID = "hide" + name;
          latestToggle = $(document.createElement('div')).append(name + "<input type='checkbox' id=" + toggleID +">");
          main.append(latestToggle);
        }
      }
      $("#hideTools").append(main);
      for(var name in worker.state){
        if(worker.state.hasOwnProperty(name)){
          var toggleID = "hide" + name;
          toggleChangeHandler(toggleID, name);
        }
      }
    };

  worker.updateVisible = function(canvasObject, isVisible){
    canvasObject.visible = isVisible;
    //canvasObject.outputObject.visible = isVisible;
    worker.canvas.renderAll();
  }

  worker.drawSelection = function(){
    /*****************************
    Need to SAVE THIS DATA FIRST!!! We will assume this is done BEFORE this function is called. Thus the current selection is our new value.
    ******************************/
    $(".selectPopulateCanvas").remove();
    var canvasObject = worker.canvas.getActiveObject();
    var category;
    var fieldList = [];
    var moveZUpID = "inari_Zup";
    var moveZDownID = "inari_Zdown";
    if(canvasObject){
      category = canvasObject.categoryType;
    }
    //Check to see if this category is a list of objects
    if(worker.state.hasOwnProperty(category) && Object.prototype.toString.call( worker.state[category] ) === "[object Array]" && worker.state[category].length > 0){
      //it is!
        var main = $(document.createElement('div')).addClass("selectPopulateCanvas");
        var outputObject = canvasObject.outputObject;
        for(var key in outputObject){
          if(outputObject.hasOwnProperty(key)){
            if(typeof(outputObject[key]) != "object"){
              var newID = "inari_" + key;
              latestField = $(document.createElement('div')).addClass("editfield small").append("<div class='outputFieldName'>" + key + ":" + "</div>" + "<input type = 'text' class='outputField' id=" + newID + ">");
              fieldList.push([newID, outputObject[key], [key]]);
              //selectionUpdateHandlers("#"+newID, canvasObject, key);
              main.append(latestField);
            }
            else{
              latestField = $(document.createElement('div')).addClass("editfield large").append("<div class='outputFieldNameBlock'>" + key + ":" + "</div>");
              for (var subkey in outputObject[key]){
                if (outputObject[key].hasOwnProperty(subkey)){
                  var newID = "inari_" + key + "_" + subkey;
                  latestField.append("<div class = 'editfield small'><div class='outputFieldName'>" + subkey + ":" + "</div>" + "<input type = 'text' class = 'outputField' id=" + newID + "></div>");
                  fieldList.push([newID, outputObject[key][subkey], [key, subkey]]);
                  //selectionUpdateHandlers("#"+newID, canvasObject, key, subkey);
                }
              }
              main.append(latestField);
            }
          }
        }
        if(worker.getZLevelFromCategory(category) != 0){
            //This means we should allow the user to adjust depth on this object.
            latestField = $(document.createElement('div')).addClass("editfield large").append("<button class='Zbutton' id=" + moveZUpID +">Increase Z level</button>")
                                                                                .append("<button class='Zbutton' id=" + moveZDownID +">Decrease Z level</button>");
            main.append(latestField);
          }
        $(".selectPopulate").append(main);
      }
    else if(worker.state.hasOwnProperty(category) && Object.prototype.toString.call( worker.state[category] ) === "[object Object]" && worker.state[category]){
      //it's a stand alone object
      var main = $(document.createElement('div')).addClass("selectPopulateCanvas");
      var outputObject = canvasObject.outputObject;
      for(var key in outputObject){
          if(outputObject.hasOwnProperty(key)){
            if(typeof(outputObject[key]) != "object"){
              var newID = "inari_" + key;
              latestField = $(document.createElement('div')).addClass("editfield small").append("<div class='outputFieldName'>" + key + ":" + "</div>" + "<input type = 'text' class='outputField' id=" + newID + ">");
              //selectionUpdateHandlers("#"+newID, canvasObject, key);
              fieldList.push([newID, outputObject[key], [key]]);
              main.append(latestField);
            }
            else{
              latestField = $(document.createElement('div')).addClass("editfield large").append("<div class='outputFieldNameBlock'>" + key + ":" + "</div>");;
              for (var subkey in outputObject[key]){
                if (outputObject[key].hasOwnProperty(subkey)){
                  var newID = "inari_" + key + "_" + subkey;
                  latestField.append("<div class = 'editfield small'><div class='outputFieldName'>" + subkey + ":" + "</div>" + "<input type = 'text' class = 'outputField' id=" + newID + "></div>");
                  fieldList.push([newID, outputObject[key][subkey], [key, subkey]]);
                }
              }
              main.append(latestField);
            }
          }
        }
        if(worker.getZLevelFromCategory(category) != 0){
            //This means we should allow the user to adjust depth on this object.
            latestField = $(document.createElement('div')).addClass("editfield large").append("<button class='Zbutton' id=" + moveZUpID +">Increase Z level</button>")
                                                                                .append("<button class='Zbutton' id=" + moveZDownID +">Decrease Z level</button>");
            main.append(latestField);
          }
        $(".selectPopulate").append(main);
      }
      //Add the button handlers if necessary
      $("#"+ moveZUpID).click(function(){
        worker.moveUpZLevel(canvasObject);
      });
      $("#"+ moveZDownID).click(function(){
        worker.moveDownZLevel(canvasObject);
      });

      //Add other handlers
      for (var i=0; i<fieldList.length; i++){
        $("#"+fieldList[i][0]).val(fieldList[i][1]);
        if(fieldList[i][2].length>1){
        selectionUpdateHandlers("#"+fieldList[i][0], canvasObject, fieldList[i][2][0], fieldList[i][2][1]);
        }
        else{
          selectionUpdateHandlers("#"+fieldList[i][0], canvasObject, fieldList[i][2][0]);
        }
      }
  }

  worker.getCanvasObjectByCategoryAndID = function(category, dropDownID){
    if(worker.state.hasOwnProperty(category)){
      if(Object.prototype.toString.call( worker.state[category] ) === "[object Array]"){
        for(var i = 0; i < worker.state[category].length; i++){
          if(worker.state[category][i].dropDownID == dropDownID){
            return worker.state[category][i];
          }
        }
      }
      else{
        if(worker.state[category] && worker.state[category].dropDownID == dropDownID){
          return worker.state[category];
        }
      }
    }
    return null;
  }

  worker.countFields = function(state){
    count = 0;
    for(var category in state) {
      if(state.hasOwnProperty(category)){
        if(category==="World"){
        }
        else if(state.hasOwnProperty(category) && Object.prototype.toString.call( state[category] ) === "[object Array]" && state[category].length > 0){
          for(var i =0; i < state[category].length; i++){
            if(state[category][i] != null){
              count+=1;
            }
          }
        }
        else if(state.hasOwnProperty(category) && Object.prototype.toString.call( state[category] ) === "[object Object]" && state[category]){
          if(state[category]!=null){
            count+=1;
          }
        }
      }
    }
    return count;
  }

  worker.populate = function(newState) {
    worker.desiredState = {};
    var desiredState = worker.desiredState;
    var total = worker.countFields(newState);
    for(var category in newState) {
      if(newState.hasOwnProperty(category)){
        if(category==="World"){
          worker.updateWorldWidth(newState.World.Width);
          worker.updateWorldHeight(newState.World.Height, true);
        }
        else if(newState.hasOwnProperty(category) && Object.prototype.toString.call( newState[category] ) === "[object Array]" && newState[category].length > 0){
          if(!desiredState.hasOwnProperty(category)){
            desiredState[category] = [];
          }
          for(var i =0; i < newState[category].length; i++){
            worker.populateImage(newState[category][i], category, i, desiredState);
          }
        }
        else if(newState.hasOwnProperty(category) && Object.prototype.toString.call( newState[category] ) === "[object Object]" && newState[category]){
          if(!desiredState.hasOwnProperty(category)){
            desiredState[category] = {};
          }
          worker.populateImage(newState[category], category, -1, desiredState);
        }
      }
    }/*
    var total = worker.countFields(newState);
    //Wait for async to finish
    while(worker.countFields(desiredState) != total){
      console.log("--");
      console.log(total);
      console.log(worker.countFields(desiredState));
    }
    for(var category in desiredState) {
      if(desiredState.hasOwnProperty(category)){
        if(category==="World"){
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Array]" && desiredState[category].length > 0){
          for(var i =0; i < desiredState[category].length; i++){
            oImg = desiredState[category][i];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change(); 
          }
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Object]" && desiredState[category]){
          oImg = desiredState[category];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change(); 
        }
      }
    }
    */
    console.log("function finished");
    worker.verifyPopulated(total);
    //worker.canvas.add(oImg);
    //worker.addObject(oImg);
    //worker.updateDropDownID(oImg.imgSource);
    //$("#categorySelect").change(); 
    //worker.canvas.renderAll();
  }
  worker.drawInOrder = function(desiredState){
    for(var category in desiredState) {
      if(desiredState.hasOwnProperty(category)){
        if(category==="World"){
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Array]" && desiredState[category].length > 0){
          for(var i =0; i < desiredState[category].length; i++){
            oImg = desiredState[category][i];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change();
          }
        }
        else if(desiredState.hasOwnProperty(category) && Object.prototype.toString.call( desiredState[category] ) === "[object Object]" && desiredState[category]){
          oImg = desiredState[category];
            worker.canvas.add(oImg);
            worker.addObject(oImg);
            worker.updateDropDownID(oImg.imgSource);
            $("#categorySelect").change(); 
        }
      }
    }
    worker.canvas.renderAll();
  }

  worker.verifyPopulated = function(targetSize){
    if(worker.countFields(worker.desiredState) == targetSize){
      console.log("Async call finished. Drawing Canvas...");
      worker.drawInOrder(worker.desiredState);
    }
    else{
      setTimeout(function(){worker.verifyPopulated(targetSize);}, 1000);
    }
  }


worker.asyncLoop = function (iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
}

  worker.populateImage  = function(outputObject, category, drawOrder, desiredState){
    fabric.Image.fromURL(outputObject.PNGSource, function(oImg){
              console.log("loaded");
              worker.updateDropDownID(outputObject.PNGSource);
              oImg.dropDownID = worker.generateDropDownID(outputObject.PNGSource);
              oImg.imgSource = outputObject.PNGSource;
              oImg.categoryType = category;
              oImg.lockScalingX = true; //make it so we cannot resize the images
              oImg.lockScalingY = true;
              //oImg.width = outputObject.Width;
              //oImg.height = outputObject.Height;
              outputObject.Width = oImg.width;
              outputObject.Height = oImg.height;
              var defaultObj = worker.generateDefaultObject(oImg);
              for (var property in defaultObj) {
                if (defaultObj.hasOwnProperty(property) && !outputObject.hasOwnProperty(property)) {
                    outputObject[property] = defaultObj[property];
                }
              }
              //This is for legacy purposes
              if(outputObject.hasOwnProperty('visible')){
                oImg.visible = outputObject.visible;
              }
              if(outputObject.hasOwnProperty("flipVertical")){
                oImg.set("flipY", outputObject.flipVertical);
              }
              if(outputObject.hasOwnProperty("flipHorizontal")){
                oImg.set("flipX", outputObject.flipHorizontal);
              }
              oImg.outputObject = outputObject;
              //worker.setLocation(oImg);
              if(oImg.outputObject.hasOwnProperty("PlistSource")){
                if(oImg.outputObject.PlistSource === "not implemented"){
                  oImg.outputObject.PlistSource = worker.imgToPlist(oImg.imgSource);
                }
                worker.updatePList(oImg.outputObject.PlistSource, oImg);
              }

              worker.updateLocation(oImg);
              
              if(drawOrder >=0){
                desiredState[category][drawOrder] = oImg;
              }
              else{
                desiredState[category] = oImg;
              }
    });
  }

  worker.toggleHorizontalFlip = function(isFlipped, canvasObject){
    canvasObject.set("flipX", isFlipped);
    worker.canvas.renderAll();
  }

  worker.toggleVerticalFlip = function(isFlipped, canvasObject){
    canvasObject.set("flipY", isFlipped);
    worker.canvas.renderAll();
  }

  worker.handleDownload = function(){
    output = {};
    output.World = {
      "Width": worker.worldWidth,
      "Height": worker.worldHeight
    };
    filename = $("#levelName").val();
    for(var key in worker.state){
      if(worker.state.hasOwnProperty(key)){
        if(Object.prototype.toString.call( worker.state[key] ) === "[object Array]"){
          output[key] = worker.state[key].map(function(canvasObject){return canvasObject.outputObject;});
        }
        else if(worker.state[key] && worker.state[key].outputObject){
          output[key] = worker.state[key].outputObject;
        }
      }
    }
    download(filename, JSON.stringify(output));
  }

  worker.handleFileSelect = function(){
      if (window.File && window.FileReader && window.FileList && window.Blob) {

      } else {
          alert('The File APIs are not fully supported in this browser.');
          return;
      }   

      input = document.getElementById('fileinput');
     if (!input.files) {
        alert("This browser doesn't seem to support the `files` property of file inputs.");
     }
     else if (!input.files[0]) {
        alert("Please select a file before clicking 'Load'");               
     }
     else {
        file = input.files[0];
        fr = new FileReader();
        fr.onload = worker.receivedFile;
        fr.readAsText(file);
     }
  }


  worker.receivedFile = function() {           
     worker.refresh();
     var newState = JSON.parse(fr.result);
     worker.populate(newState);
  } 

  worker.snapToGrid = function (parameter){
    return Math.round(parameter / worker.grid) * worker.grid;
  }

  worker.deselect = function(){
    worker.hoverImage = null;
    $(".selected").removeClass("selected");
  }

  worker.initializeTypeGenerators = function(){
    worker.objectTypeGenerators = {
                    "ForegroundLayers": worker.createForegroundLayer,
                    "BackgroundLayers":  worker.createBackgroundLayer,
                    "BackgroundAestheticDetails":  worker.createBackgroundAestheticDetail,
                    "ForegroundAestheticDetails":  worker.createForegroundAestheticDetail,
                    "AnimatedDetails" : worker.createAnimatedDetail,
                    "EnvironmentTiles":  worker.createTile,
                    "Avatar":  worker.createAvatar,
                    "Nodes":  worker.createNode,
                    "Spawners":  worker.createSpawner,
                    "Turrets": worker.createTurret,
                    "Enemies":  worker.createEnemy,
                    "Goal":  worker.createGoal,
                    "Hazards": worker.createHazard,
                    "Portals": worker.createPortal,
                    "CheckPoints": worker.createCheckPoint,
                    "Receptacles" : worker.createReceptacle
                 };
  }

  worker.updatePList = function(plistFile, canvasObject){
    $.getJSON(plistFile, {}, function(data){
      if(data.hasOwnProperty("shape")){
        canvasObject.outputObject.PList = data.shape;
      }
    });
  }

  worker.initializeDownloader = function(){
    $("#btnLoad").click(worker.handleFileSelect);
    $("#btnSave").click(worker.handleDownload);
    //Make sure we don't delete anything by accident
    $("#levelName").focus(function(){
      $("#categorySelect").change();
    });
  }
  worker.init = function(){
    worker.refresh();
    worker.initializeTypeGenerators();
    worker.initializeCanvasHandlers();
    worker.initializeWorldControls();
    worker.initializeDownloader();
  }

  worker.init();
  return worker;
};


//------------------------------------------------------End Worker-------------------------------------------
var worker = {};
var canvas;
$(document).ready(function(){
  worker = createWorker();

  $.getJSON("drawTypes.json", {}, function(data){
    //Preload Images
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        if(data[key].hasSubCategory){
          for(var i = 0; i<data[key].img.length; i++){
            //Set up the dropdown menu for drawing tiles
            if(key === "EnvironmentTiles"){
              worker.addToDropDown("#drawing-mode-selector", data[key].img[i].name);
              //console.log(data[key].img[i]);
            }
            for(var subI = 0; subI<data[key].img[i].imgList.length; subI++){
              $("<img />").attr("src", data[key].img[i].imgList[subI]);
            }
          }
        }
        else{
          for(var i = 0; i<data[key].img.length; i++){
            $("<img />").attr("src", data[key].img[i]);
          }
        }
      }
    }
    //----
    worker.drawData = data;
    worker.removeAllOptions("#categorySelect");
    worker.removeAllOptions("#categoryTool");
    worker.removeAllOptions("#subcategorySelect");
    worker.removeAllOptions("#subcategoryTool");

    worker.addChangeHandler("#categoryTool", categoryToolUpdate);
    worker.addChangeHandler("#subcategoryTool", subcategoryToolUpdate);
    worker.addChangeHandler("#categorySelect", categorySelectUpdate);
    worker.addChangeHandler("#subcategorySelect", subcategorySelectUpdate);
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        worker.addToDropDown("#categorySelect", key);
        worker.addToDropDown("#categoryTool", key);
      }
    }
    categoryToolUpdate();
    categorySelectUpdate();

    // PHIL: show overlay
    showOverlay();
  });

  // toggler hover effects
  $("#toolToggler").mouseover(function(){
    if ($("#toolToggler").hasClass("minimized")) {
      $("#arrow").css("border-color", "transparent #fafafa transparent transparent");
    } else {
      $("#arrow").css("border-color", "transparent transparent transparent #fafafa");
    }
  });

  $("#toolToggler").mouseout(function(){
    if ($("#toolToggler").hasClass("minimized")) {
      $("#arrow").css("border-color", "transparent #999999 transparent transparent");
    } else {
      $("#arrow").css("border-color", "transparent transparent transparent #999999");
    }
  });

  function showOverlay() {
    $(document).clearQueue();
      // show overlay - instant
      $("#instructionOverlay").show();
      // darken overlay
      $("#instructionOverlay").animate(
        {"background-color": "rgba(0,0,0,0.6)"}, 
        {
          duration: 500,
          complete: function() {
            $("#instructionBox").show();
            $("#instructionBox").animate(
              {top: "50%"}, 500
            );
          }
        }
      );
    }

  function hideOverlay() {
    $(document).clearQueue();
    // hide box
    $("#instructionBox").animate(
      {top: "-20%"}, 500
    );
    $("#instructionBox").hide(
      {
        duration: 1,
        complete: function() {
          $("#instructionOverlay").animate(
            {"background-color": "rgba(0,0,0,0.0)"},
            {
              duration: 500,
              complete: function() {
                $("#instructionOverlay").hide();
              }
            }
          );
        }
      }
    );
  }

  // open instructions
  $("#icon").click(function() {
    showOverlay();
  });

  // close instructions
  $("#closeInstructions").click(function() {
    hideOverlay();
  });

});




function categoryToolUpdate(){
  worker.removeAllOptions("#subcategoryTool");
  worker.hoverImage = null;
  selection = $("#categoryTool").val();
  worker.toolDropMap = {};
  if(worker.drawData[selection].hasSubCategory){
    for(var i = 0; i < worker.drawData[selection].img.length; i++){
      if(i ==0){
        worker.tools = worker.drawData[selection].img[0].imgList;
      }
      worker.addToDropDown("#subcategoryTool", worker.drawData[selection].img[i].name);
      worker.toolDropMap[worker.drawData[selection].img[i].name] = i;
    }
  }
  else{
    worker.tools = worker.drawData[selection].img;
    worker.addToDropDown("#subcategoryTool", "No subcategories");
  }
  worker.drawTools();
}

function subcategoryToolUpdate(){
  category = $("#categoryTool").val();
  subcategory = $("#subcategoryTool").val();
  if(worker.drawData[category].hasSubCategory){
    subcategoryIndex = worker.toolDropMap[subcategory];
    worker.tools = worker.drawData[category].img[subcategoryIndex].imgList;
    worker.drawTools();
  }
}

function categorySelectUpdate(){
  categorySelectRedraw();
  $("#subcategorySelect").change();
}

function categorySelectRedraw(){
  worker.removeAllOptions("#subcategorySelect");
  var selection = $("#categorySelect").val();
  worker.selectDropMap = {};
  worker.addToDropDown("#subcategorySelect", worker.defaultSelectPrompt);
  if(Object.prototype.toString.call( worker.state[selection] ) === "[object Array]"){
    for(var i = 0; i < worker.state[selection].length; i++){
      worker.addToDropDown("#subcategorySelect", worker.state[selection][i].dropDownID);
    }
  }
  else{
    if(worker.state[selection]){
      worker.addToDropDown("#subcategorySelect", worker.state[selection].dropDownID);
    }
  }
}

function subcategorySelectUpdate(){
  category = $("#categorySelect").val();
  subcategory = $("#subcategorySelect").val();
  canvasObject = worker.getCanvasObjectByCategoryAndID(category, subcategory);
  if(canvasObject){
    worker.canvas.setActiveObject(canvasObject);
  }
  else{
    worker.canvas.deactivateAll().renderAll();
  }
  worker.drawSelection();
}

function toggle(self){
  if($(self).hasClass("selected")){
    //Deselect
    worker.deselect();
  }
  else{
    //Adjust view
    worker.deselect();
    $(self).addClass("selected");
    worker.hoverImage = {
      'src': $(self).find('img').attr('src'),
      'canvasElement': null,
      'type' : $("#categoryTool").val()
    };
  }
}

function tileClickHandler(tile){
  $(tile).mousedown(function(){
    toggle(this);
  });
}

function toggleChangeHandler(toggleID, stateName){
  $("#" + toggleID).change(function(){
      if(worker.state.hasOwnProperty(stateName)){
        var elems = worker.state[stateName];
        var isChecked = $(this).is(":checked");
        if(Object.prototype.toString.call( elems ) === "[object Array]"){
          for(var i=0; i< elems.length; i++){
            worker.updateVisible(elems[i], !isChecked);
          }
        }
        else{
          worker.updateVisible(elems, !isChecked);
        }
      }
    });
}

function selectionUpdateHandlers(selection,canvasObject, key, subkey){
  $(selection).blur(function(){
    if(subkey){
      var typedReturn = typeFunctions(canvasObject.outputObject[key][subkey], $(selection).val());
      $(selection).val(typedReturn);
      canvasObject.outputObject[key][subkey] = typedReturn;
      if(key==="Location"){
        worker.updateLocation(canvasObject);
      }
    }
    else{
      var typedReturn = typeFunctions(canvasObject.outputObject[key], $(selection).val());
      $(selection).val(typedReturn);
      canvasObject.outputObject[key] = typedReturn;
      if(key==="PlistSource"){
        worker.updatePList(typedReturn, canvasObject);
      }
      if(key==="flipVertical"){
        worker.toggleVerticalFlip(typedReturn, canvasObject);
      }
      if(key==="flipHorizontal"){
        worker.toggleHorizontalFlip(typedReturn, canvasObject);
      }
    }
  });
  $(selection).keyup(function(event){
    if(event.keyCode == 13){
      if(subkey){
        var typedReturn = typeFunctions(canvasObject.outputObject[key][subkey], $(selection).val());
        $(selection).val(typedReturn);
        canvasObject.outputObject[key][subkey] = typedReturn;
        if(key==="Location"){
          worker.updateLocation(canvasObject);
        }
      }
      else{
        var typedReturn = typeFunctions(canvasObject.outputObject[key], $(selection).val());
        $(selection).val(typedReturn);
        canvasObject.outputObject[key] = typedReturn;
        if(key==="PlistSource"){
          worker.updatePList(typedReturn, canvasObject);
        }
        if(key==="flipVertical"){
        worker.toggleVerticalFlip(typedReturn, canvasObject);
        }
        if(key==="flipHorizontal"){
          worker.toggleHorizontalFlip(typedReturn, canvasObject);
        }
      }
    }
  });
}

function typeFunctions(target, input){
  type = typeof(target);
  if (type ==="boolean"){
    return input.toUpperCase() === "TRUE";
  }
  else if (type ==="number"){
    return Number(input);
  }
  else{
    return String(input);
  }
}

function removeHandler(tile){
  $(tile).off();
}


function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

