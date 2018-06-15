// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

window.$ = window.jQuery = require('jquery')
window.Tether = require('tether')
window.Bootstrap = require('bootstrap')

var SwaggerParser = require('swagger-parser');

var jsonBeautify = require("json-beautify");
var prettyjson = require('prettyjson');
var dbUtil = require('./dataUtil.js')
var utils = require('./utils.js')
const url = require('url')
const http = require('http');
const https = require('https');
const fs = require('fs');
var elerem = require('electron').remote;
var dialog = elerem.dialog;
var electronApp = elerem.app;
const path = require('path');
const request = require('request');
var FormData = require('form-data');
var querystring = require('querystring');

var protocol = null;


require('electron').ipcRenderer.on('newRequest', function(event, message) {
  $('#requestModal').modal('toggle');
});
require('electron').ipcRenderer.on('sendRequest', function(event, message) {
  app.getResponse();
});
require('electron').ipcRenderer.on('focusUrlBar', function(event, message) {
  $('#inputUrl').focus();
});


var count = 0;
function buildTreeData(obj, parentObj, callback) {
      count++;
      parentObj.isTypeCollection = true;
      parentObj.nodes = [];
      dbUtil.db.collection.find({parent: parentObj._id}, function(err, resCollection) {
  		    parentObj.nodes = parentObj.nodes.concat(resCollection)
          dbUtil.db.request.find({collectionId: parentObj._id}, function(err, resRequest) {
              parentObj.nodes = parentObj.nodes.concat(resRequest);
              for (var i in parentObj.nodes) {
                if ('parent' in parentObj.nodes[i]) {
                  buildTreeData(obj, parentObj.nodes[i], callback);
                }
              }
              count--;
              count===0 && callback(obj);
          })
      })
  }

module.exports = {
	state : {
		collections : [],
		selectedRequest : null,
		selectedCollection : null,
		selectedMenuId : null,
		selectedMenuType : null
	},
	prettyjson,

  loadRequestsData : function(callback) {
    dbUtil.db.collection.find({parent: null}, function(err, res) {
		var obj = {nodes:res};
		count=0;
		for (var k in res) {
			buildTreeData(obj, obj.nodes[k], callback);
		}
    })
  },

  loadHistoryData : function() {
    db.history.find({}).sort({createdAt : -1}).exec(function(err, res) {
			app.history = res;
      $('#historyList').html(historyListTemplate(utils.groupBy(res, 'historyDate')));
    })
	},

	reloadCollectionList : function() {
		app.loadRequestsData(function(res){
			$('#collectionsList').html(collectionListTemplate(res));
		});
	},

  setSelectedRequest : function(requestObj) {
    app.selectedRequest = requestObj
    app.selectedRequest.bodyType = app.selectedRequest.bodyType ? app.selectedRequest.bodyType : 'NoBody';

    $("#inputUrl").val(app.selectedRequest.uri);
    $("#method").html(app.selectedRequest.method);
    $("#requestBodyTypeDropdown").html($('[data-value="'+ app.selectedRequest.bodyType +'"]').html());
  	if(app.selectedRequest.bodyType === "JSON"){
  	    $('#requestBodyTypeRawContent').text(app.selectedRequest.bodyText);
  	} else {
  	    $('#requestBodyTypeRawContent').text(app.selectedRequest.bodyText);
  	}
    this.changeRequestBodyType(app.selectedRequest.bodyType);
    app.showQueryParameters();
    app.showHeaders();
    app.showFormParameters();

    app.showResponseValues(app.selectedRequest.response);
  },
	setSelectedCollection: function(collectionId){
		dbUtil.getParentCollectionById(collectionId, function(err,res){
			 app.state.selectedCollection = res;
		});
	},
  showHeaders : function() {
    var requestFormRowTemplate = Handlebars.compile($("#requestFormRowTemplate").html());
		if(app.selectedRequest.headers && app.selectedRequest.headers.length) {
			$('#headerView').html(requestFormRowTemplate(app.selectedRequest.headers));
    } else {
      $('#headerView').html(requestFormRowTemplate([{name:'', value: ''}]));
    }
  },

  showFormParameters : function() {
    var requestFormFormDataTemplate = Handlebars.compile($("#requestFormFormDataTemplate").html());
    var requestFormLoadFormDataTemplate = Handlebars.compile($("#requestFormLoadFormDataTemplate").html());
		if(app.selectedRequest.formParams && app.selectedRequest.formParams.length) {
			$('#requestBodyTypeFormContainer').html(requestFormLoadFormDataTemplate(app.selectedRequest.formParams));
    } else {
	  $('#requestBodyTypeFormContainer').html(requestFormFormDataTemplate([{name:'', value: ''}]));
    }
  },

  importFile : function(filename, success, failure) {
    SwaggerParser.validate(filename)
      .then(function(api) {
        console.log(api)
        dbUtil.getCollection(api.info.title, function(err, res) {

            res.length && success ({
              error: true,
              info: api.info,
            })

            !res.length && dbUtil.addCollection(api.info.title, api.info.description, null, function(err, res) {
                for (var path in api.paths) {
                  for (var method in api.paths[path]) {
                    var formParams = [];
                    for (var param in api.paths[path][method].parameters) {
                      if (api.paths[path][method].parameters[param].in == 'formData') {
                        formParams.push({
                          name: api.paths[path][method].parameters[param].name,
                          value: null
                        });
                      }
                    }
                    dbUtil.addRequest({
                      name : api.paths[path][method].summary ? api.paths[path][method].summary : path,
                      uri : api.schemes[0] + "://" + api.host + api.basePath + path,
                      method : method.toUpperCase(),
                      desc : api.paths[path][method].description,
                      collectionId : res._id,
                      bodyType : null,
                      bodyText : null,
                      headers : [],
                      formParams : formParams
                    });
                  }
                }
                success ({
                  error: false,
                  info: api.info,
                })
            })
        })
      })
      .catch(function(err) {
		$.getJSON(filename, function( obj ) {
			if(app.validateRestOre(obj)){
				dbUtil.getParentLevelCollection(obj.name, function(err, res) {
					if(res.length){
						var r = confirm(obj.name+ " already exists. Do you want to create a Copy of it?");
						if (r === true) {
							app.getUniqueCollection(res,obj.name,obj,success);
						}
					}else {
						app.getUniqueCollection(res,obj.name,obj,success);
					}
				});

			} else if(app.validatePostManV2AndAbove(obj)){
				dbUtil.getParentLevelCollection(obj.info.name, function(err, res) {
					if(res.length){
						var r = confirm(obj.info.name+ " already exists. Do you want to create a Copy of it?");
						if (r === true) {
							app.getUniqueCollection(res,obj.info.name,obj,success);
						}
					} else {
						app.getUniqueCollection(res,obj.info.name,obj,success);
					}
				});

			} else if(app.validatePostManV1(obj)){
				dbUtil.getParentLevelCollection(obj.name, function(err, res) {
					if(res.length){
						var r = confirm(obj.name+ " already exists. Do you want to create a Copy of it?");
						if (r === true) {
							app.getUniqueCollectionName(res,obj,obj.name,success);
						}
					} else {
						app.getUniqueCollectionName(res,obj,obj.name,success);
					}
				});
			} else {

				failure ({error: true, message: filename + "is not a valid file"});
			}
			$('#importExportModal .modal-body .loading').remove();
		});
      });
	},

	deleteForm : function(e1){
		if($(e1).siblings(".x-request-form-key-input").val()=== "Authorization"){
			$('#requestAuthTab a[data-value="NoAuth"]').click()
		} else {

			}
		$(e1).parents(".x-request-form-wrapper")[0].remove();
	},

	deleteQueryForm : function(el){
		$(el).parents(".x-request-form-wrapper")[0].remove();
		app.handleQueryFormInput();
	},

	showQueryParameters : function(){
		var inputUrl = document.querySelector("#inputUrl").value;
		var parsedUrl = url.parse(inputUrl);
		var requestQueryNoDataTemplate = Handlebars.compile(document.getElementById("requestQueryNoDataTemplate").innerHTML);
		var requestQueryTemplate = Handlebars.compile(document.getElementById("requestQueryTemplate").innerHTML);
		if(app.hasQueryString(inputUrl)) {
			var query_string = app.QueryStringToJSON(parsedUrl);
			$('#queryView').html(requestQueryTemplate(query_string));
		} else {
      $('#queryView').html(requestQueryNoDataTemplate({}));
    }
	},
	hasQueryString : function(url){
		if(url.includes('?')){
			return true;
		} else {
			return false;
		}
	},
	QueryStringToJSON : function(url) {
		var pairs = url.query.split('&');

		var result = {};
		pairs.forEach(function(pair) {
			pair = pair.split('=');
			result[pair[0]] = decodeURIComponent(pair[1] || '');
		});

		return JSON.parse(JSON.stringify(result));
	},
	handleQueryFormInput : function(){
		var queryParameters = {};
		$('#queryView .x-request-form-key-input').each(function(){
			if($(this).val()){
				queryParameters[$(this).val()] = $(this).siblings('.x-request-form-value-input').val();
			}
		})
		var inputUrl =document.querySelector("#inputUrl").value;
		if(app.hasQueryString(inputUrl)){
			inputUrl  = inputUrl.substring(0,inputUrl.indexOf('?'));
		}
		const url = new URL(inputUrl);
		const params = new URLSearchParams(url.search);
		for(var key in queryParameters){
			if (queryParameters.hasOwnProperty(key)) {
				params.set(key, queryParameters[key]);
			}
		}
		document.querySelector("#inputUrl").value = params.toString() ? (url+"?"+params.toString()) : url;
	},
	handleFormAsfile: function(ev) {
		if($(ev).siblings('.x-request-form-value-input').attr("type")==="text"){
			$(ev).siblings('.x-request-form-value-input').attr("type","file");
		} else {
			$(ev).siblings('.x-request-form-value-input').attr("type","text");
		}
		$(ev).toggleClass('fa-file fa-font')
	},

	getResponse :function () {
    $('#responseContainer').append('<div class="loading"></div>');
		var requestURL = document.querySelector("#inputUrl").value;
		var method = document.querySelector("#method").innerHTML;
		var parsedUrl = url.parse(requestURL);
    this.selectedRequest.uri = requestURL;
    this.selectedRequest.method = method;
    this.selectedRequest.headers = this.getRequestHeaders();
    this.selectedRequest.formParams = this.getRequestFormParams();
    this.selectedRequest.bodyText = $('#requestBodyTypeRawContent').text();
    this.selectedRequest.bodyType = $('#requestBodyTypeDropdown').attr('data-value');
		var requestBody;
		var requestHeaders = {};
		$.each(this.selectedRequest.headers, function(k, headerObj){
			requestHeaders[headerObj.name] = headerObj.value
		});

		var options = {
			url: requestURL,
			port: $("#preferencesModalEnable").prop("checked") ? $('#preferencesModalPort').val(): parsedUrl.port,
			protocol: parsedUrl.protocol,
			host: $("#preferencesModalEnable").prop("checked") ? $('#preferencesModalServerName').val(): parsedUrl.hostname,
			path: $("#preferencesModalEnable").prop("checked") ? this.selectedRequest.uri : parsedUrl.pathname + (parsedUrl.search ? parsedUrl.search : ''),
			method: method,
			headers: requestHeaders
		};
		console.log(options);
		const startTime = (new Date()).getTime();

    protocol = (options.url.indexOf('https') == 0) ? https : http;

		const req = protocol.request(options, function(res){

			var data = '';
			res.on('data', (chunk) => {
				data += `${chunk}`
			});
			res.on('end', () => {

        $('#responseContainer .loading').remove();

				const timeTaken = (new Date()).getTime() - startTime;

        const responseObj = {
          statusCode : res.statusCode,
          statusMessage : res.statusMessage,
          timeTaken : timeTaken,
          responseByteSize : res.socket.bytesRead,
          content : data,
          headers: res.headers
        };
        app.showResponseValues(responseObj);
        app.selectedRequest.response = responseObj;

        dbUtil.addToHistory(app.selectedRequest, (res)=> {
          app.loadHistoryData()
          if (app.selectedRequestType == 'HISTORY') {
            app.selectedRequest = res;
          }
        })

        if (app.selectedRequestType == 'COLLECTION') {
          dbUtil.updateRequest(app.selectedRequest, (res)=> {
            app.selectedRequest = res;
            // app.loadRequestsData(function(res) {
            //   $('#collectionsList').html(collectionListTemplate(res));
            // });
          })
        }

        //dbUtil.updateResponseToHistory(app.selectedRequest._id, responseObj);
			});
		});

		if(this.selectedRequest.bodyType === "MultipartForm"){
			var formData = new FormData();
			for(var i in this.selectedRequest.formParams){
				if(this.selectedRequest.formParams[i].type === "text"){
					formData.append(this.selectedRequest.formParams[i].name, this.selectedRequest.formParams[i].value);
				} else {
					formData.append(this.selectedRequest.formParams[i].name, fs.createReadStream(this.selectedRequest.formParams[i].value[0].path));
				}
			}
			formData.submit(requestURL);
		} else if(this.selectedRequest.bodyType === "FormURLEncoded") {
			var data = querystring.stringify(app.getFormURLEncodedObj(this.selectedRequest.formParams));
			req.write(data);
		} else {
			req.write(this.selectedRequest.bodyText);
		}
		req.end();
	},

	getFormURLEncodedObj: function(FormURLEncodedObj) {
		var formUrlEncoded = {};
		$.each(FormURLEncodedObj, function(k, formObj){
			formUrlEncoded[formObj.name] = formObj.value
		});
		return formUrlEncoded;
	},

	changeAuthorizationHeader: function(typeOfAuth){
		var requestFormRowTemplate = Handlebars.compile(document.getElementById("requestFormRowTemplate").innerHTML);
		var setAuthorizationType = false;
		var typeOfToken,secondaryToken;
		if((typeOfAuth=="BasicAuth")){
		  typeOfToken=	"#enableBasicToken";
		 //secondaryToken="#enableBearerToken";
		}else if((typeOfAuth=="BearerToken")){
		  typeOfToken=	"#enableBearerToken";
  		 // secondaryToken="#enableBasicToken";
		}
		if($(typeOfToken).prop("checked")){
			$('#headerView .x-request-form-key-input').each(function() {
				if ($(this).val() == "" || $(this).val() == "Authorization") {
					$(this).attr("value", "Authorization");
					if(typeOfAuth === "BasicAuth"){
						$(this).siblings('.x-request-form-value-input').attr("value","Basic " + new Buffer($("#basicAuthUsername").val() + ":" + $("#basicAuthPassword").val()).toString("base64"));
					}else if(typeOfAuth === "BearerToken"){
						$(this).siblings('.x-request-form-value-input').attr("value",(!$("#prefixValue").val().length? "Bearer":$("#prefixValue").val()) +" "+ $("#bearerToken").val());
					}else{
						app.setDummyHeader();
					}
					setAuthorizationType = true;
					return false;
				}
			})
			if(!setAuthorizationType){
				if(typeOfAuth=="BasicAuth"){
					$('#headerView').append(requestFormRowTemplate([{'name':'Authorization','value':"Basic " + new Buffer($("#basicAuthUsername").val() + ":" + $("#basicAuthPassword").val()).toString("base64")}]));
				}else if(typeOfAuth=="BearerToken"){
					$('#headerView').append(requestFormRowTemplate([{'name':'Authorization','value':$("#prefixValue").val().length? "Bearer":$("#prefixValue").val() +" "+ $("#bearerToken").val()}]));
				}
			}
		}else{
			app.setDummyHeader();
			// !$(secondaryToken).prop("checked")?app.setDummyHeader():true;
		}
	},

	setDummyHeader :function(){
		$('#headerView .x-request-form-key-input').each(function() {
			if ($(this).val() == "Authorization") {
				$(this).parents(".x-request-form-wrapper")[0].remove();
				if($('#headerView').children(".x-request-form-wrapper").length==0){
					$('#headerView').append(requestFormRowTemplate([{'name':"",'value':""}]));
				}
			}

		});
	},

	removeFromHistory : function(historyId){
		$("#deleteModel .modal-body").append('<div class="loading"></div>');
		dbUtil.removeFromHistory(historyId, function(){
			$("#deleteModel .modal-body .loading").remove();
			$("#deleteModel").modal("toggle");
			$('#historyList li[data-history-id="' + historyId + '"]').remove();
		})
	},

	getHistoryById : function(historyId, callback){
				dbUtil.getHistoryById(historyId, function(err, res){
					callback(res);
				})
	},

  setContentTypeHeader: function(contentType) {
	  var setContentType = false;
	  $('#headerView .x-request-form-key-input').each(function() {
	 	if ($(this).val() == "" || $(this).val() == "Content-Type") {
			$(this).attr("value", "Content-Type");
			$(this).siblings('.x-request-form-value-input').attr("value", contentType);
			setContentType = true;
			return false;
		}
	  })
	  if (!setContentType) {
		var requestFormRowTemplate = Handlebars.compile(document.getElementById("requestFormRowTemplate").innerHTML);
		$('#headerView').append(requestFormRowTemplate([{name:"Content-Type", value:contentType}]));

	  }

	},

  getRequestHeaders : function() {
    var headers = [];
		$('#headerView .x-request-form-key-input').each(function(){
			if($(this).val()){
				headers.push({
          name : $(this).val(),
          value : $(this).siblings('.x-request-form-value-input').val()
        });
      }
    });
    return headers;
  },

  getRequestFormParams : function() {
    var formParams = [];
		$('#requestBodyTypeFormContainer .x-request-form-key-input').each(function(){
			if($(this).val()){
				if($(this).siblings('.x-request-form-value-input').attr("type")==="text"){
				formParams.push({
          name : $(this).val(),
						  value : $(this).siblings('.x-request-form-value-input').val(),
						  type : "text",
						  bodyType : $('#requestBodyTypeDropdown').attr('data-value')
        });
				} else {

					formParams.push({
						  name : $(this).val(),
						  value : $(this).siblings('.x-request-form-value-input').get(0).files,
						  type : "file",
						  bodyType : $('#requestBodyTypeDropdown').attr('data-value')
					});
      }
			}
    });
    return formParams;
  },

  addCollection : function(name, desc, parentId){
    $('#collectionModal .modal-body').append('<div class="loading"></div>');
    dbUtil.addCollection(name, desc, parentId, function() {
      $('#collectionModal .modal-body .loading').remove();
      $('#collectionModalInputName').val("");
      $('#collectionModalInputDesc').val("");
			$('#collectionModal').modal('toggle');
			app.reloadCollectionList();
    })
  },

  initializePreferences : function() {
	var preferencesObjToUse = {};
	var defaultPreferencesObj = {
		proxy : {
			server : '',
			port : '',
			enabled : false
		}
	}
	dbUtil.getPreferences(function(res){

		if(!res){
			dbUtil.addPreferences(defaultPreferencesObj, function(insertedRes){

			});
			preferencesObjToUse = defaultPreferencesObj;
		} else {
			preferencesObjToUse = res;
		}
		$("#preferencesModalServerName").prop("value", preferencesObjToUse.proxy.server);
		$("#preferencesModalPort").prop("value", preferencesObjToUse.proxy.port);
		$("#preferencesModalEnable").prop("checked", preferencesObjToUse.proxy.enabled);
	});
  },

  resetPreferences : function() {
	$('#preferencesModal .modal-body').append('<div class="loading"></div>');
	  var defaultPreferencesObj = {
			proxy : {
				server : '',
				port : '',
				enabled : false
			}
		}
		dbUtil.updatePreferences(defaultPreferencesObj, function(res){

		$("#preferencesModalServerName").prop("value", res.proxy.server);
		$("#preferencesModalPort").prop("value", res.proxy.port);
		$("#preferencesModalEnable").prop("checked", res.proxy.enabled);
		$('#preferencesModal .modal-body .loading').remove();
		$('#preferencesModal').modal('toggle');
		});
  },

  updatePreferences : function(){
	$('#preferencesModal .modal-body').append('<div class="loading"></div>');
	  var updatedPreferencesObj = {
		proxy : {
			server : $('#preferencesModalServerName').val(),
			port : $('#preferencesModalPort').val(),
			enabled : $("#preferencesModalEnable").prop("checked")
		}
	  }
	  dbUtil.updatePreferences(updatedPreferencesObj, function(res){

		$("#preferencesModalServerName").prop("value", res.proxy.server);
		$("#preferencesModalPort").prop("value", res.proxy.port);
		$("#preferencesModalEnable").prop("checked", res.proxy.enabled);
		$('#preferencesModal .modal-body .loading').remove();
		$('#preferencesModal').modal('toggle');
	  })
	},

  addRequest : function(obj, callback){
		console.log("add request");
    dbUtil.addRequest(obj, callback)
	},
	removeRequest : function(requestId) {
		$("#deleteModel .modal-body").append('<div class="loading"></div>');
    dbUtil.removeRequest(requestId, function () {
				$("#deleteModel .modal-body .loading").remove();
				$("#deleteModel").modal("toggle");
				$('li[data-request-id="' + requestId + '"]').remove();
    });
  },

  populateCollectionList : function(elementId, doSelectDefault){
		const element = $('#'+elementId);
		element.html('');
		console.log(elementId)
    dbUtil.getCollections(function(res){
			console.log(res)
			for (var i in res) {
					if(doSelectDefault && res[i]._id == app.state.selectedMenuId){
						element.append("<option selected value='"+ res[i]._id +"'>"+res[i].name+"</option>");
					} else {
						element.append("<option value='"+ res[i]._id +"'>"+res[i].name+"</option>");
					}
				}
		});
	},

	duplicateRequest : function(){
		dbUtil.getRequest(app.state.selectedMenuId, function(err, res){
			res.name = res.name+" - copy",
			res._id = "",
			res.createdAt = ""
			dbUtil.addRequest(res, function(res){
				console.log(res);
			})
		})
		app.reloadCollectionList();
	},

	updateCollection : function(collectionId, name, desc){
		$('#renameCollectionModel .modal-body').append('<div class="loading"></div>');
		dbUtil.updateCollection(collectionId, name, desc, function(){
			$('#renameCollectionModel .modal-body .loading').remove();
			$('#renameCollectionModel').modal('toggle');
			app.reloadCollectionList();
		})
	},

	removeCollection : function(collectionId){
		$("#deleteModel .modal-body").append('<div class="loading"></div>');
    dbUtil.removeCollection(collectionId, function(){
			$("#deleteModel .modal-body .loading").remove();
			$("#deleteModel").modal("toggle");
			$('li[data-collection-id="' + collectionId + '"]').remove();
    });
	},

	getCollectionById : function(collectionId){
    dbUtil.getCollectionById(collectionId, function(err,res){
			$("#renameCollectionModelInputName").val(res.name);
			$("#renameCollectionModelInputDesc").val(res.description);
	 });
	},

	getRequest : function(requestId) {
		dbUtil.getRequest(requestId, function(err,rq){
			$("#renameRequestModelInputName").val(rq.name);
			$("#renameRequestModelInputDesc").val(rq.description);
	 });
	},

	updateRequestById : function(requestId, name, desc) {
		$("#renameRequestModel .modal-body").append('<div class="loading"></div>');
		dbUtil.updateRequestById(requestId, name, desc, function(err,rq){
			$('#renameRequestModel .modal-body .loading').remove();
			$('#renameRequestModel').modal('toggle');
			app.reloadCollectionList();
	 });
	},

  changeRequestBodyType : function(type) {
    $('#requestBodyTypeDropdown').attr('data-value', type);

    if (type == 'NoBody') {
      $("#requestBodyTypeTabList a[href='#requestBodyTypeNoBody']").tab('show');
    }
    else if (type == 'MultipartForm') {
	  var requestFormFormDataTemplate = Handlebars.compile(document.getElementById("requestFormFormDataTemplate").innerHTML);
      $("#requestBodyTypeTabList a[href='#requestBodyTypeForm']").tab('show');
	  if($("#requestBodyTypeFormContainer").children().length==0 || app.getRequestFormParams().length === 0){
		  $('#requestBodyTypeFormContainer').html(requestFormFormDataTemplate([{}]));
	  } else {
		  $('#requestBodyTypeFormContainer').html(requestFormFormDataTemplate(app.getRequestFormParams()));
    }
    }
	else if (type == 'FormURLEncoded') {
		var requestFormFormUrlEncodedTemplate = Handlebars.compile(document.getElementById("requestFormFormUrlEncodedTemplate").innerHTML);
		$("#requestBodyTypeTabList a[href='#requestBodyTypeForm']").tab('show');
		if($("#requestBodyTypeFormContainer").children().length==0 || app.getRequestFormParams().length === 0){
			$('#requestBodyTypeFormContainer').html(requestFormFormUrlEncodedTemplate([{}]));
		} else {
			formParams = app.getRequestFormParams().filter( function(formParams){
				return formParams.type ==="text"
			});
			$('#requestBodyTypeFormContainer').html(requestFormFormUrlEncodedTemplate(formParams));
		}
    }
    else if (type == 'JSON' || type == 'XML' || type == 'Text' || type == 'Other') {
      $("#requestBodyTypeTabList a[href='#requestBodyTypeRaw']").tab('show');
    }
  },

  switchToFormURLEncodedConfirm : function(){
	  $("#requestBodyTypeDropdown").html($('[data-value="FormURLEncoded"]').html());
	  app.changeRequestBodyType('FormURLEncoded');
	  app.setContentTypeHeader('application/x-www-form-urlencoded');
	  $('#switchToFormURLEncodedTypeModel').modal('toggle');
  },

  changeRequestAuthType : function(type) {
    $('#requestAuthTypeDropdown').attr('data-value', type);
    if (type == 'NoAuth') {
      $("#requestAuthTypeTabList a[href='#requestAuthTypeNoAuth']").tab('show');
    }
    else if (type == 'BasicAuth' || type == 'DigestAuth') {
      $("#requestAuthTypeTabList a[href='#requestAuthTypeBasicAuth']").tab('show');
    }
    else if (type == 'OAuth1' || type == 'OAuth2') {
      $("#requestAuthTypeTabList a[href='#requestAuthTypeOAuth2']").tab('show');
    }
    else if (type == 'BearerToken') {
      $("#requestAuthTypeTabList a[href='#requestAuthTypeBearerToken']").tab('show');
    }
    else if (type == 'ManagedAuth') {
      $("#requestAuthTypeTabList a[href='#requestAuthTypeManagedAuth']").tab('show');
  		dbUtil.getAllAuthRequest(function(err,docs){
  			var managedAuthModalRequestTemplate = Handlebars.compile(document.getElementById("managedAuthModalRequestTemplate").innerHTML);
  			$('#managedAuthModalRequestList').html(managedAuthModalRequestTemplate(docs));
  		});
      $('#managedAuthModal').modal('toggle');
    }
	app.changeAuthorizationHeader($('#requestAuthTypeDropdown').attr('data-value'));
  },

  showResponseValues : function(responseObj) {
    $('#responseContainer #noResponseContainer').remove();

    if (!responseObj) {
      $('#responseContainer').append($('#noResponseScreen').html());
      return false;
    }

    var statusClass;
    if (responseObj.statusCode.toString().charAt(0) == '1') {
      statusClass = 'bg-primary';
    } else if ((responseObj.statusCode.toString().charAt(0) == '2')) {
      statusClass = 'bg-success';
    } else if ((responseObj.statusCode.toString().charAt(0) == '3')) {
      statusClass = 'bg-warning';
    } else if ((responseObj.statusCode.toString().charAt(0) == '4')) {
      statusClass = 'bg-error';
    } else if ((responseObj.statusCode.toString().charAt(0) == '5')) {
      statusClass = 'bg-error';
    }

    $('#statusCode').remove();
    $('#responseContainerHead').prepend(responseStatusTemplate({
      statusCode: responseObj.statusCode,
      statusMessage: responseObj.statusMessage,
      statusClass: statusClass
    }));

    $('#timeTaken').html("<b>TIME </b>"+ responseObj.timeTaken +" "+"ms");

    var bytesText;
    if(responseObj.responseByteSize>999){
      bytesText = (responseObj.responseByteSize/1024).toFixed(2) + 'KB';
    }
    else if(responseObj.responseByteSize>1999)
    {
      bytesText = (responseObj.responseByteSize/1024).toFixed(2) + 'MB';
    }
    else{
      bytesText = (responseObj.responseByteSize/1) + 'B';
    }
    $('#bytes').html('<b>SIZE </b>' + bytesText);


    //Headers
    $('#responseHeaders').html(responseHeaderTemplate(responseObj.headers));
    try {
		if(responseObj.headers['content-type'] === "application/json"){
			$("#errorTab").hide();
			$('#responsePreview').html(app.prettifyJSON(JSON.stringify(JSON.parse(responseObj.content), null, 2)));
		}else{
			$('#responsePreview').text(responseObj.content);
			$("#errorTab").hide();
		}
	}
    catch (e) {

      $('#responsePreview').text(responseObj.content);

      $("#errorTab").show();
      $("#errorTab").val(e);
    }
  },

  prettifyJSON : function(content) {
      const json = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
          var cls = 'x-body-number';
          if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                  cls = 'x-body-key';
              } else {
                  cls = 'x-body-string';
              }
          } else if (/true|false/.test(match)) {
              cls = 'x-body-boolean';
          } else if (/null/.test(match)) {
              cls = 'x-body-null';
          }
          return '<span class="' + cls + '">' + match + '</span>';
      });
  },

  populateCollectionsListForExport : function() {
    $("#importExportModalExportCollectionList").children().remove();
    $("#importExportModalExportCollectionList").prop("checked", false);
    db.collection.find({parent: null}, function(err, res) {
      $("#importExportModalExportCollectionList").html(exportCollectionListTemplate(res));
    });
  },

	validatePostManV1: function(obj) {
		return obj.hasOwnProperty("name") && obj.hasOwnProperty("folders") && obj.hasOwnProperty("requests");
	},
	validatePostManV2AndAbove: function(obj) {
		return (obj.hasOwnProperty("info") && obj.hasOwnProperty("item"));
	},
	addCollectionsList: function(item , collectionId){
		for (var i in item) {
			const itemList = item[i];
			if(itemList.item !== undefined){
				dbUtil.addCollection(itemList.name, itemList.description, collectionId, function(err, res) {
					app.addCollectionsList(itemList.item,res._id);
				});
			} else {
				var formParams =[];
				var headers =[];
				var bodyType = "";//NoBody, JSON, XML, Other, MultipartForm, FormURLEncoded
				var bodyText = "";
				if(itemList.request.body.mode !== undefined && itemList.request.body.mode === 'raw'){
					bodyType = "Other";
				} else if(itemList.request.body.mode === 'formdata'){
					bodyType = "MultipartForm";
				} else if(itemList.request.body.mode === 'urlencoded'){
					bodyType = "FormURLEncoded";
				}
				if(!($.isEmptyObject(itemList.request.body)) && itemList.request.body.mode !=="raw" && !($.isEmptyObject(itemList.request.body[itemList.request.body.mode]))
					&& itemList.request.body[itemList.request.body.mode].length > 0) {
					$.each(itemList.request.body[itemList.request.body.mode], function(key,val){
						formParams.push({
							name: val.key,
							value: val.value
						});
					});
				}
				if(itemList.request.header){
					$.each(itemList.request.header,function(key,val){
						headers.push({
							name: val.key,
							value: val.value
						});
						if(bodyType === "Other" && val.key === "Content-Type"){
							if(val.value === "application/json"){
								bodyType = "JSON";
								bodyText = itemList.request.body.raw
							} else if(val.value === "application/xml") {
								bodyType = "XML";
								bodyText = itemList.request.body.raw
							}
						}
					});
				}
				dbUtil.addRequest({
                    name : itemList.name,
                    uri : typeof(itemList.request.url) =="object" ?itemList.request.url.raw :itemList.request.url,
                    method : itemList.request.method.toUpperCase(),
                    desc : itemList.request.description,
                    collectionId : collectionId,
                    bodyType : bodyType,
                    bodyText : bodyText,
                    headers : headers,
                    formParams : formParams
                },function() {});
			}
		}
	},
	getUniqueCollection: function(res,collectionName,collectionObj,success){
		var collectionInfoObj = !collectionObj.info ? collectionObj :collectionObj.info;
		if(res.length){
			var resObj = res[0];
			// if -Copy is found and not at the end add "-Copy" to collection Name
			// else get the copy number and increment
			if(resObj.name.indexOf("-Copy") > -1 && resObj.name.length - 1 >= (resObj.name.lastIndexOf("-Copy") + 4 )){
				collectionName = collectionInfoObj.name + "-Copy" +
				(parseInt(resObj.name.substr(resObj.name.lastIndexOf("-Copy") + 5 , resObj.name.length) === ""? 0: resObj.name.substr(resObj.name.lastIndexOf("-Copy") + 5 , resObj.name.length ),10) + 1);
			} else {
				collectionName = resObj.name + "-Copy";
			}
			dbUtil.getParentLevelCollection(collectionName, function(err, res1) {
				app.getUniqueCollection(res1,collectionName,collectionObj,success);
			});
		} else {
			dbUtil.addCollection(collectionName, collectionInfoObj.description, null, function(err, res) {
				if(app.validateRestOre(collectionObj)){
					app.addRestOreCollectionsList(collectionObj.nodes,res._id);
				} else {
					app.addCollectionsList(collectionObj.item,res._id);
				}
				success ({
					error: false,
					info: {title : collectionName}
				})
			});
		}
	},
	exportCollection: function (){
		dbUtil.getParentCollectionById(app.state.selectedCollection._id, function(err, res){
			var obj = {};
			count=0;
			buildTreeData(obj, res, function(){
					var toLocalPath = path.resolve(electronApp.getPath("desktop"), app.state.selectedCollection.name.replace(" ","_")+".json" )
					var userChosenPath = dialog.showSaveDialog({ defaultPath: toLocalPath });

					if(userChosenPath){
						fs.writeFileSync(userChosenPath, JSON.stringify(res,null,2))
					}
				});
			});
	},

	exportMultipleCollections : function() {
    var selectedCollectionsObj = { nodes: [] };
    app.loadRequestsData(function(res) {
      if($("#selectAllCollections").is(':checked')) {
        selectedCollectionsObj = res;
      } else {

        $.each(res.nodes, function(key, val) {
          if($("#export-collection-" + val._id).is(':checked')) {
            selectedCollectionsObj.nodes.push(val);
          }
        });
      }
    });

		var toLocalPath = path.resolve(electronApp.getPath("desktop"), "CollectionList.json" )
		var userChosenPath = dialog.showSaveDialog({ defaultPath: toLocalPath });
		if(userChosenPath){
			fs.writeFileSync(userChosenPath, JSON.stringify(selectedCollectionsObj, null, 2));
		}
	},

	validateRestOre: function(obj){
		return obj.hasOwnProperty("name") && obj.hasOwnProperty("nodes");
	},

	addRestOreCollectionsList: function(item, collectionId){
		for (var i in item) {
			const itemList = item[i];
			if(itemList.nodes !== undefined){
				dbUtil.addCollection(itemList.name, itemList.description, collectionId, function(err, res) {
					app.addRestOreCollectionsList(itemList.nodes,res._id);
				});
			} else {
				dbUtil.addRequest({
					name : itemList.name,
					uri : itemList.uri,
					method : itemList.method.toUpperCase(),
					desc : itemList.description,
					collectionId : collectionId,
					bodyType : itemList.bodyType,
					bodyText : itemList.bodyText,
					headers : itemList.headers,
					formParams : itemList.formParams
				},function() {});
			}
		}
	},
	simplifyPostManV1Object: function(res,folderObj,obj,success){
		var formParams =[];
		var headers =[];
		var bodyType = "";//NoBody, JSON, XML, Other, MultipartForm, FormURLEncoded
		var bodyText = "";

		folderObj.order &&	$.each(obj.requests, function(reqKey, reqVal){
				formParams =[];
				headers =[];
				bodyType = "";
				bodyText = "";
				if(folderObj.id === reqVal.folder){
					if(reqVal.dataMode !== undefined && reqVal.dataMode === 'raw'){
						bodyType = "Other";
						bodyText = reqVal.rawModeData;
					} else if(reqVal.dataMode=== 'params'&& reqVal.data && reqVal.data.length){
						bodyType = "MultipartForm";
					} else if(reqVal.dataMode === 'urlencoded' && reqVal.data && reqVal.data.length){
						bodyType = "FormURLEncoded";
					} else {
						bodyType = "Other";
					}
					$.each(reqVal.data, function(key1,val1){
						formParams.push({
							name : val1.key,
							value : val1.value
						});
					});
					if(reqVal.headerData === undefined){
						/*headers.push({
							name: reqVal.headers.split(":")[0],
							value: ((reqVal.headers.split(":")[1]).split("\n"))[0]
						});*/
					} else {
						$.each(reqVal.headerData, function(key1, val1){
							headers.push({
								name: val1.key,
								value: val1.value
							});
						});

					}
					dbUtil.addRequest({
						name : reqVal.name,
						uri : reqVal.url,
						method : reqVal.method.toUpperCase(),
						desc : reqVal.description,
						collectionId : res._id,
						bodyType : bodyType,
						bodyText : bodyText,
						headers : headers,
						formParams : formParams
					}, function() {})
				}
			});
		if(folderObj.folders_order.length){
			$.each( folderObj.folders_order, function(key, val){
				$.each(obj.folders, function(folderkey,folderVal){
					if(val === folderVal.id ){
						dbUtil.addCollection(folderVal.name, folderVal.description, res._id, function(err, res1) {
							app.simplifyPostManV1Object(res1,folderVal,obj,success);
						});
					}

				});
			});
		} else {
			$.each(folderObj.folders, function(folderkey,folderVal){
						dbUtil.addCollection(folderVal.name, folderVal.description, res._id, function(err, res1) {
							app.simplifyPostManV1Object(res1,folderVal,obj,success);
						});
				});
		}

	},
	getUniqueCollectionName: function (res,obj,collectionName,success){
			if(res.length){
				if(collectionName.indexOf("-Copy") > -1 && collectionName.length - 1 >= (collectionName.lastIndexOf("-Copy") + 4 )){
					collectionName = obj.name + "-Copy" +
					(parseInt(collectionName.substr(collectionName.lastIndexOf("-Copy") + 5 , collectionName.length) === ""? 0: collectionName.substr(collectionName.lastIndexOf("-Copy") + 5 , collectionName.length ),10) + 1);
				} else {
					collectionName = collectionName + "-Copy";
				}
				dbUtil.getParentLevelCollection(collectionName, function(err, res1) {
					app.getUniqueCollectionName(res1, obj, collectionName, success);
				});
			} else {
				dbUtil.addCollection(collectionName, obj.description, null, function(err, res) {
					app.simplifyPostManV1Object(res, obj,obj, success);
				});
				success ({
					error: false,
					info: {title : collectionName}
				})
			}
	},
	getSearchData: function(searchInput,callback)
	{
		var collObj ={}
		collObj.nodes =[];
		app.getFilteredSearchData(searchInput,function(res){


			if (!res.length) {
				//print no results
				callback(res)
	}
			else {

				var parentNodes = res.filter(function(val){
					return val.parent === null;
				})
				var obj = {nodes:parentNodes};
				count=0;

				for (var k in parentNodes) {
					app.buildSearchTreeData(obj, obj.nodes[k], res,callback);
}
			}
		})
	},
	buildSearchTreeData: function(obj, parentObj,res, callback){

		count++;
		parentObj.nodes = [];
		var parentNodes = res.filter(function(val){
			return val.parent === parentObj._id;
		});
		parentObj.nodes = parentObj.nodes.concat(parentNodes);
		var requestNodes = res.filter(function(val){
			return val.collectionId !== undefined && val.collectionId == parentObj._id;
		});

		parentObj.nodes = parentObj.nodes.concat(requestNodes);
		for (var i in parentObj.nodes) {
			if ('parent' in parentObj.nodes[i]) {
			  app.buildSearchTreeData(obj, parentObj.nodes[i],res, callback);
			}
        }
        count--;
        count===0 && callback(obj);
	},
	getFilteredSearchData:function(searchInput,callback){
		var searchNodes =[]
		dbUtil.getSearchResults(searchInput ,function(err,res){
			var numOfResults = res.length;

			if (!res.length) {
				callback(res);
			} else {
			$.each(res, function(key,val){
					var intCount = 0;
					searchNodes._id !== val._id && searchNodes.push(val);
					app.setParentLevelCollections(searchNodes,val, function(searchNodes1){
						searchNodes = searchNodes1;
						//callback(searchNodes)
						if(val.isTypeCollection == undefined){
							callback(searchNodes);
						} else {
							app.setChildrenNodes(searchNodes,val, function(searchNodes2){
								searchNodes=searchNodes2;
								callback(searchNodes)

							});
						}
					})
				});
			}
		});
	},
	setParentLevelCollections: function(searchNodes,collectionObj,callback){
		if(collectionObj.parent || collectionObj.isTypeCollection == undefined){
			var parentId = (collectionObj.isTypeCollection == undefined) ? collectionObj.collectionId : collectionObj.parent;
			dbUtil.db.collection.findOne({_id: parentId}, function(err, resCollection) {
				var parentObj={};
				parentObj = resCollection;
				parentObj.isTypeCollection = true;
				var found = searchNodes.some(function (resObj) {
					return resObj._id === parentObj._id;

				});
				if(!found){
					searchNodes.push(parentObj);
					app.setParentLevelCollections(searchNodes,parentObj,callback);
				}
			});
		} else {
			callback(searchNodes)

		}
	},
	setChildrenNodes: function(searchNodes,collectionObj,callback) {
		dbUtil.db.collection.find({parent: collectionObj._id}, function(err, res) {
  		if(res.length){
				$.each(res, function(key,resCollection){
					var childObj={};
					childObj = resCollection;
					childObj.isTypeCollection = true;
					var found = searchNodes.some(function (resObj) {
						return resObj._id === childObj._id;
					});
					if(!found){
						searchNodes.push(childObj);
					}

					app.setChildrenNodes(searchNodes,childObj,callback);

					dbUtil.db.request.find({collectionId: childObj._id}, function(err, res) {
						$.each(res, function(key,resCollection){
							var found = searchNodes.some(function (resObj) {
								return resObj._id === resCollection._id;
							});
							if(!found){
								searchNodes.push(resCollection)
							}
						});
						callback(searchNodes);
					})
				});
			}
		  else {
			dbUtil.db.request.find({collectionId: collectionObj._id}, function(err, res) {
				$.each(res, function(key,resCollection){
					var found = searchNodes.some(function (resObj) {
						return resObj._id === resCollection._id;
					});
					if(!found){
						searchNodes.push(resCollection)
					}
				});
				callback(searchNodes);
			});
		}
      });

	},
	importFileChooseHandler: function(){
		dialog.showOpenDialog((fileNames) => {
			if(fileNames === undefined){
				console.log("No file selected");
				return;
			} else{
				$('#importExportModal .modal-body').append('<div class="loading"></div>');
				app.importFile(fileNames[0], function(res) {
					$('#importExportModal .modal-body .loading').remove();
					alert('\''+res.info.title + '\' imported as a new collection!')
					$('#importExportModal').modal('toggle');
              }, function(err) {
					$('#importExportModal .modal-body .loading').remove();
					alert(err.message);
              });
			}
		});
	},

	onAuthManageTypeSelect : function(type) {
		if(type === 'Bearer'){
			$("#managedAuthModalcreateRequestMethodBearerToken").show();
			$("#managedAuthModalcreateRequestMethodOAuth2").hide();

		} else if (type === 'Oauth2'){
			$("#managedAuthModalcreateRequestMethodOAuth2").show();
			$("#managedAuthModalcreateRequestMethodBearerToken").hide();
		}
	},
	addAuthRequest: function(){
		var authObj = {
			authType : "BearerToken",
			bearerToken: {
        tokenProperty : 123
      },
			request : {
      }
		}
		dbUtil.addAuthorizations(authObj, function(err, docs){
			console.log(docs)
		})
	},
	deleteAuthRequest : function(elm){
		dbUtil.deleteAuthRequest($(elm).attr('data-auth-id'),function(err,numberRemoved){
			if(numberRemoved > 0){
				dbUtil.getAllAuthRequest(function(err,docs){
					var managedAuthModalRequestTemplate =Handlebars.compile(document.getElementById("managedAuthModalRequestTemplate").innerHTML);
					$('#managedAuthModalRequestList').html(managedAuthModalRequestTemplate(docs));
				});
			}
		})
	},

  handleManagedAuthCreateRequestHeadersAdd: function() {
    $('#managedAuthModalCreateRequestHeadersForm').append(requestFormRowTemplate([{}]));
  },

  handleManagedAuthCreateRequestTypeChange: function() {
    $('#managedAuthCreateRequestModalAuthTypeBearerView').hide();
    $('#managedAuthCreateRequestModalAuthTypeOAuth2View').hide();

    if ($('#managedAuthCreateRequestModalAuthTypeInput').val() == 'BearerToken') {
      $('#managedAuthCreateRequestModalAuthTypeBearerView').show();
    } else if($('#managedAuthCreateRequestModalAuthTypeInput').val() == 'OAuth2') {
      $('#managedAuthCreateRequestModalAuthTypeOAuth2View').show();
    }
  },

  changeAuthRequestBodyType : function(type) {
    $('#managedAuthCreateRequestBodyTypeDropdown').attr('data-value', type);

    if (type == 'NoBody') {
      $("#managedAuthModalCreateRequestBodyTypeTabList a[href='#managedAuthModalCreateRequestBodyTypeNoBody']").tab('show');
    }
    else if (type == 'MultipartForm') {
  	  var requestFormFormDataTemplate = Handlebars.compile(document.getElementById("requestFormFormDataTemplate").innerHTML);
      $("#managedAuthModalCreateRequestBodyTypeTabList a[href='#managedAuthModalCreateRequestBodyTypeForm']").tab('show');
  	  if($("#managedAuthModalCreateRequestFormContainer").children().length==0 || app.getRequestFormParams().length === 0){
  		  $('#managedAuthModalCreateRequestFormContainer').html(requestFormFormDataTemplate([{}]));
  	  } else {
  		  $('#managedAuthModalCreateRequestFormContainer').html(requestFormFormDataTemplate(app.getRequestFormParams()));
      }
    }
  	else if (type == 'FormURLEncoded') {
  		var requestFormFormUrlEncodedTemplate = Handlebars.compile(document.getElementById("requestFormFormUrlEncodedTemplate").innerHTML);
  		$("#managedAuthModalCreateRequestBodyTypeTabList a[href='#managedAuthModalCreateRequestBodyTypeForm']").tab('show');
  		if($("#managedAuthModalCreateRequestFormContainer").children().length==0 || app.getRequestFormParams().length === 0){
  			$('#managedAuthModalCreateRequestFormContainer').html(requestFormFormUrlEncodedTemplate([{}]));
  		} else {
  			var formParamsObj = app.getRequestFormParams().filter( function(formParams){
  				return formParams.type ==="text"
  			});
  			$('#managedAuthModalCreateRequestFormContainer').html(requestFormFormUrlEncodedTemplate(formParamsObj));
  		}
    }
    else if (type == 'JSON' || type == 'XML' || type == 'Text' || type == 'Other') {
      $("#managedAuthModalCreateRequestBodyTypeTabList a[href='#managedAuthModalCreateRequestBodyTypeRaw']").tab('show');
    }
  },

  executeAuthRequest : function(authRequestObj, requestObj) {
    //execute authRequest

    //get token
    //set token to request
    //call execute request
  },

  selectResponseText : function() {
      var containerid = "responsePreview";
      if (document.selection) { // IE
          var range = document.body.createTextRange();
          range.moveToElementText(document.getElementById(containerid));
          range.select();
      } else if (window.getSelection) {
          var range = document.createRange();
          range.selectNode(document.getElementById(containerid));
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
      }
  }

}
