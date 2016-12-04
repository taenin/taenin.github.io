var createCSEditor = function(){
	var worker = {};
	worker.refresh = function(){
		//used for unique action ID creation
		worker.actionsCreated = 0;
		worker.items.clear();
		worker.groups.clear();
		worker.defaultActionDuration = 3000;
		worker.CutSceneTypeEnum = {
			StartCutSceneAction: 0,
			CameraAction: 1,
			AvatarAction: 2,
		};

		worker.CutSceneSubTypes = {
			StartCutSceneAction: {},
			CameraAction: {
				MoveCamera: 0
			},
			AvatarAction: {}
		};
		worker.CutSceneMapNumberToType = worker.getReverseEnum(worker.CutSceneTypeEnum);
		worker.CutSceneMapNumberToSubType = worker.getLayeredReverseEnum(worker.CutSceneMapNumberToType, worker.CutSceneSubTypes);
		worker.cutSceneID = "New Cut Scene";
		worker.rootAction = {id: worker.cutSceneID, end: 0, childActions: [], ActionType: worker.CutSceneTypeEnum.StartCutSceneAction};
		worker.currentActionId = null;
		worker.currentGroup = null;
		worker.currentAction = null;
		worker.actionFields = {};
		worker.defaultActionType = worker.CutSceneTypeEnum.CameraAction;
		worker.defaultSubType = worker.CutSceneSubTypes.CameraAction.MoveCamera;
		worker.actionTypeSelectRedraw();
	}

	worker.generateDefaultObject = function(actionTypeEnum, actionSubtypeEnum){
	    var output = {}
	    var actionString = worker.CutSceneMapNumberToSubType[actionTypeEnum][actionSubtypeEnum];
	    if(worker.objectTypeGenerators.hasOwnProperty(actionString)){
	        output = worker.objectTypeGenerators[actionString]();
	    }
	    return Object.assign(worker.actionRequiredFields(), output);
	}

	//A mapping from specific action sub types to a function that generates an object with the default fields required for the specified sub type
	worker.initializeTypeGenerators = function(){
    	worker.objectTypeGenerators = {
                    "MoveCamera": worker.createMoveCamera,
        };
  	}

  	//The fields required, regardless of action type
  	worker.actionRequiredFields = function(){
  		return {
  			WaitForAnimation: true,
  			WaitForPhysical: true,
  			Delay: 0,
  		};
  	};

  	worker.createMoveCamera = function(){
  		return {
  			TargetLocation: {X: 0, Y: 0},
  			TravelTime: 1,
  			RequireX: true,
  			RequireY: true,
  		};
  	};

	worker.getReverseEnum = function(enumMap){
		var output = {};
		for (var key in enumMap){
			output[enumMap[key]] = key;
		}
		return output;
	}

	worker.getLayeredReverseEnum = function(enumKeys, mapToReverse){
		var output = {}
		for(var key in enumKeys){
			output[key] = worker.getReverseEnum(mapToReverse[enumKeys[key]]);
		}
		return output;
	}

	worker.getUniqueActionId = function(){
		var actionId = "Action" + worker.actionsCreated;
		worker.actionsCreated++;
		return actionId;
	}
	worker.getItem = function(itemId){
		return itemId === worker.cutSceneID ? worker.rootAction : worker.items.get(itemId);
	}
	worker.addActionItem = function(actionId, parentId, group, start, duration){
		if(!worker.items.get(actionId)){
			parent = worker.getItem(parentId);
			worker.items.add({
				id: actionId,
				group: group,
				content: actionId,
				start: start,
				end: start + duration,
				parentAction: parentId,
				childActions: [],
				ActionType: worker.defaultActionType,
				ActionSubtype: worker.defaultSubType,
			});
			if(parent){
				parent.childActions.push(actionId);
				if(parentId !== worker.cutSceneID){
					worker.items.update(parent);
				}
			}
		}
	};

	worker.removeActionItem = function(removedAction){
		if(removedAction && removedAction.parentAction && removedAction.childActions && removedAction.id){
			parentObject = worker.getItem(removedAction.parentAction);
			newChildren = [];
			parentObject.childActions = parentObject.childActions.filter((childId) =>childId !== removedAction.id);
			//Don't fire an update if we're touching the root node
			actionsToUpdate = removedAction.parentAction === worker.cutSceneID ? [] : [parentObject];
			removedAction.childActions.forEach((childId) => {
				childObject = worker.items.get(childId);
				childObject.parentAction = removedAction.parentAction;
				parentObject.childActions.push(childId);
				actionsToUpdate.push(childObject);
			});
			worker.items.update(actionsToUpdate);
		}
	}

	worker.setCurrentAction = function(actionId){
		worker.currentActionId = actionId;
		worker.currentAction = actionId ? worker.getItem(actionId) : null;
		worker.actionTypeSelectRedraw();
	}

	worker.addHandlers = function(){
		//Handle action removal
		worker.items.on("remove", function(e, removedObjectWrapper){
			removedObjectWrapper.oldData.forEach( function(oldData){
				worker.removeActionItem(oldData);
			});
			worker.currentAction = null;
			worker.currentActionId = null;
			worker.drawSelection();
		});

		$("#newAction").click(function(event){
			var actionId = worker.getUniqueActionId();
			var parentObject = worker.currentActionId ? worker.items.get(worker.currentActionId) : worker.rootAction;
			worker.addActionItem(actionId, parentObject.id, worker.currentGroup, parentObject.end, worker.defaultActionDuration);
		});

		worker.timeline.on("select", function(result){
			if(result && result.items && result.items.length > 0){
				worker.setCurrentAction(result.items[0]);
			}
			else{
				//Set our root as the current action
				worker.setCurrentAction(null);
			}
		});

		worker.addChangeHandler("#actionTypeSelect", function(){
			var selection = $("#actionTypeSelect").val();
			if(worker.currentAction && (worker.currentAction.ActionType !== worker.CutSceneTypeEnum[selection])){
				worker.currentAction.ActionType = worker.CutSceneTypeEnum[selection];
				worker.items.update(worker.currentAction);
			}
			worker.subactionTypeSelectRedraw();
		});

		worker.addChangeHandler("#subactionTypeSelect", function(){
			var parentSelection = $("#actionTypeSelect").val();
			var selection = $("#subactionTypeSelect").val();
			if(worker.currentAction){
				worker.currentAction.ActionSubtype = worker.CutSceneSubTypes[parentSelection][selection];
				worker.actionFields = worker.generateDefaultObject(worker.CutSceneTypeEnum[parentSelection], worker.CutSceneSubTypes[parentSelection][selection]);
				var actionFieldsCopy = Object.assign({}, worker.actionFields);
				worker.currentAction = Object.assign(actionFieldsCopy, worker.currentAction);
				worker.items.update(worker.currentAction);
			}
			worker.drawSelection();
		});
	}


	//Populates the edit fields if an element of the timeline is selected
	worker.drawSelection = function(){
	  //Immediately clear the canvas
	  $(".selectPopulateTimeline").remove();
	  var fieldList = [];
	  if (worker.currentAction && worker.actionFields){
	      //An object is selected
	      var main = $(document.createElement('div')).addClass("selectPopulateTimeline");
	      var outputObject = worker.currentAction;
	      for(var key in worker.actionFields){
	          if(outputObject.hasOwnProperty(key)){
	            if(typeof(outputObject[key]) != "object"){
	              var newID = "inari_" + key;
	              latestField = $(document.createElement('div')).addClass("editfield small").append("<div class='outputFieldName'>" + key + ":" + "</div>" + "<input type = 'text' class='outputField' id=" + newID + ">");
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
	        $(".selectPopulate").append(main);
	      }

	      //Add other handlers
	      for (var i=0; i<fieldList.length; i++){
	        $("#"+fieldList[i][0]).val(fieldList[i][1]);
	        if(fieldList[i][2].length>1){
	          worker.selectionUpdateHandlers("#"+fieldList[i][0], worker.currentAction, fieldList[i][2][0], fieldList[i][2][1]);
	        }
	        else{
	          worker.selectionUpdateHandlers("#"+fieldList[i][0], worker.currentAction, fieldList[i][2][0]);
	        }
	      }
	}

	worker.actionTypeSelectRedraw = function(){
		worker.removeAllOptions("#actionTypeSelect");
		for(var actionType in worker.CutSceneTypeEnum){
			worker.addToDropDown("#actionTypeSelect", actionType);
		}
		if(worker.currentAction){
			$("#actionTypeSelect").val(worker.CutSceneMapNumberToType[worker.currentAction.ActionType]);
		}
		$("#actionTypeSelect").change();
	}

	worker.subactionTypeSelectRedraw = function(){
		worker.removeAllOptions("#subactionTypeSelect");
		if(worker.currentAction){
			var parentSelection = worker.CutSceneMapNumberToType[worker.currentAction.ActionType];
			for(var subactionType in worker.CutSceneSubTypes[parentSelection]){
				worker.addToDropDown("#subactionTypeSelect", subactionType);
			}
			if(worker.CutSceneMapNumberToSubType[worker.currentAction.ActionType] && worker.CutSceneMapNumberToSubType[worker.currentAction.ActionType][worker.currentAction.ActionSubtype]){
				$("#subactionTypeSelect").val(worker.CutSceneMapNumberToSubType[worker.currentAction.ActionType][worker.currentAction.ActionSubtype]);
			}
		}
		$("#subactionTypeSelect").change();
	}

	worker.init = function(){
		worker.initializeTypeGenerators();
		worker.groups = new vis.DataSet([
		{"content": "Main Timeline", "id": "Main Timeline", "value": 1, className:'openwheel'}
		]);
		worker.items = new vis.DataSet([
			{start: 0, end: 5000, group:"Main Timeline", className:"openwheel", content:"Argentina",id:"531@motocal.net"},
			{start: 1, end: 3000, group:"Main Timeline", className:"rally", content:"Rallye Monte-Carlo",id:"591@motocal.net"},
			]);
		worker.container = document.getElementById('visualization');
		worker.options = {
		    // option groupOrder can be a property name or a sort function
		    // the sort function must compare two groups and return a value
		    //     > 0 when a > b
		    //     < 0 when a < b
		    //       0 when a == b
		    groupOrder: function (a, b) {
		      return a.value - b.value;
		    },
		    groupOrderSwap: function (a, b, groups) {
		    	var v = a.value;
		    	a.value = b.value;
		    	b.value = v;
		    },
		    orientation: 'both',
		    editable: true,
		    groupEditable: true,
		    showMajorLabels: false,
		    min: 0,
		    max: 80000,
		    start: 0,
		    end: 80000
		};

		worker.timeline = new vis.Timeline(worker.container);
		worker.timeline.setOptions(worker.options);
		worker.timeline.setGroups(worker.groups);
		worker.timeline.setItems(worker.items);		
		worker.addHandlers();
		worker.refresh();
		worker.groups.add({"content": "Main Timeline", "id": "Main Timeline", "value": 1, className:'openwheel'});
		worker.currentGroup = "Main Timeline";

	}

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

	worker.selectionUpdateHandlers = function(selection,actionObject, key, subkey){
	  $(selection).blur(function(){
	    if(subkey){
	      var typedReturn = worker.typeFunctions(actionObject[key][subkey], $(selection).val());
	      $(selection).val(typedReturn);
	      actionObject[key][subkey] = typedReturn;
	    }
	    else{
	      var typedReturn = worker.typeFunctions(actionObject[key], $(selection).val());
	      $(selection).val(typedReturn);
	      actionObject[key] = typedReturn;
	    }
	    worker.items.update(actionObject);
	  });

	  $(selection).keyup(function(event){
	    if(event.keyCode == 13){
	      if(subkey){
	        var typedReturn = worker.typeFunctions(actionObject[key][subkey], $(selection).val());
	        $(selection).val(typedReturn);
	        actionObject[key][subkey] = typedReturn;
	      }
	      else{
	        var typedReturn = worker.typeFunctions(actionObject[key], $(selection).val());
	        $(selection).val(typedReturn);
	        actionObject[key] = typedReturn;
	      }
	      worker.items.update(actionObject);
	    }
	  });
	}

	worker.typeFunctions = function(target, input){
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

	return worker;
}




 //-----------------------------------------Initialize Page---------------------------------------
 var csEditor = {};
 $(document).ready(function(){
	csEditor = createCSEditor();
	csEditor.init();
 });

