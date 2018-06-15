var Datastore = require('nedb');
db = {};
db.request = new Datastore('./reliquaStore/request.db');
db.history = new Datastore('./reliquaStore/history.db');
db.collection = new Datastore('./reliquaStore/collection.db');
db.preferences = new Datastore('./reliquaStore/preferences.db');
db.authorizations = new Datastore('./reliquaStore/authorizations.db');

db.request.loadDatabase();
db.history.loadDatabase();
db.collection.loadDatabase();
db.preferences.loadDatabase();
db.authorizations.loadDatabase();

xxx = {
  response : {
    createdAt : '',
    statusCode : '',
    statusMessage : '',
    timeTaken : '',
    responseByteSize : '',
    content : '',
    headers: [{
      key : '',
      value : ''
    }]
  }
}

module.exports = {
  db,
  // REQUESTS

  addRequest : function(requestObj, callback) {
    var data = {
      name : requestObj.name,
      uri : requestObj.uri,
      method : requestObj.method,
      description : requestObj.desc,
      collectionId : requestObj.collectionId,
      createdAt : (new Date()).getTime(),
      active : true,
      bodyType : requestObj.bodyType, //NoBody, JSON, XML, Other, MultipartForm, FormURLEncoded
      bodyText : requestObj.bodyText, //Used in case of JSON, XML, Other
      headers : requestObj.headers, //array to store headers`
      formParams : requestObj.formParams //array to store form params
    }
    db.request.insert(data, function (err, res) {
        console.log('Added new request : requestObj.name')
        callback(res);
    });
  },

  removeRequest : function(requestId, callback) {
    db.request.remove({_id : requestId}, {}, function (err, numRemoved) {
        console.log('Removed request : requestId')
        //return numRemoved;
        callback(err, numRemoved);
    });
  },

  getRequest : function(requestId, callback) {
    db.request.findOne({ _id: requestId }, function (err, doc) {
        //return doc;
        callback(err, doc);
    });
  },

  getRequests : function(searchText, collectionId) {
    collectionId && db.request.find({$or: [{ "name" : RegExp(searchText)}, {"uri" : RegExp(searchText)}],"collectionId" : collectionId} , function (err, docs) {
      return docs;
    });

    !collectionId && db.request.find({$or: [{ "name" : RegExp(searchText)}, {"uri" : RegExp(searchText)}]}, function (err, docs) {
      return docs;
    });
  },

  updateRequest : function(requestObject, callback) {
    db.request.update({_id: requestObject._id}, requestObject, {returnUpdatedDocs: true}, function(err, numAffected, affectedDocuments, upsert){
      callback(affectedDocuments);
    })
  },

	//preferences

	updatePreferences : function(preferencesObj, callback) {
		console.log(preferencesObj);
		db.preferences.update({}, { $set : preferencesObj} , {returnUpdatedDocs: true}, function (err, numRemoved, updatedPreferences,upsert) {
			console.log('Update preference : ' + updatedPreferences)
			callback(updatedPreferences);
		});
	},

	addPreferences : function(preferencesObj, callback) {
		db.preferences.insert(preferencesObj, function (err, newDoc) {
			console.log('Added new preference : preference' + preferencesObj );
			callback(err, newDoc);
		});
	},

	getPreferences : function(callback){
		db.preferences.findOne({}, function (err, docs) {
			callback(docs);
		});
	},

  // COLLECTIONS

  getCollections : function(callback) {
    db.collection.find({}, function (err, docs) {
      callback(docs);
    });
  },

  getCollection : function(collectionName, callback) {
    db.collection.find({name : collectionName}, function (err, doc) {
      callback(err, doc);
    });
  },
	getParentLevelCollection : function(collectionName, callback) {
		db.collection.find({name : collectionName,parent : null}, function (err, doc) {
			callback(err, doc);
		});
	},
  addCollection : function(name, desc, parentId, callback) {
    var data = {
      name : name,
      description : desc,
      createdAt : (new Date()).getTime(),
      parent: parentId
    }
    db.collection.insert(data, function (err, newDoc) {
        console.log('Added new collection : ' + name)
        callback(err, newDoc);
    });
  },

  removeCollection : function(collectionId, callback) {
    db.collection.remove({_id : collectionId}, {}, function (err, numRemoved) {
        console.log('Removed collection : ' + collectionId)

        db.request.remove({collectionId : collectionId}, {multi : true}, function (err, numRemoved) {
            console.log('Removed collection requests : ' + collectionId)
            //return numRemoved;
            callback(numRemoved);
        });
    });
  },

  updateCollection : function(collectionId, name, desc, callback) {
    var collectionObj = {
      name : name,
      description : desc,
      updatedAt : (new Date()).getTime()
    }
    db.collection.update({_id : collectionId}, { $set : collectionObj }, function (err, numRemoved) {
        console.log('Update collection : ' + name)
        callback(err, numRemoved);
    });
  },

  updateRequestById : function(requestId, name, desc, callback) {
    var requestObj = {
      name : name,
      description : desc,
      updatedAt : (new Date()).getTime()
    }
    db.request.update({_id : requestId}, { $set : requestObj }, function (err, numRemoved) {
        console.log('Update request : ' + name)
        callback(err, numRemoved);
    });
  },


  // HISTORY
  getHistory : function() {
    db.history.find({}).sort({createdAt : -1}).exec(function(err, docs){
      console.log(docs);
      return docs;
    })
  },

  getHistoryById : function(historyId, callback) {
    db.history.findOne({_id: historyId }, function (err, doc) {
        callback(err, doc);
    });
  },

  addToHistory : function(historyObj, callback) {
    var data = {
      name : historyObj.name,
      uri : historyObj.uri,
      method : historyObj.method,
      createdAt : (new Date()).getTime(),
      historyDate : (new Date((new Date()).toDateString())).getTime(),
      bodyType : historyObj.bodyType, //NoBody, JSON, XML, Other, MultipartForm, FormURLEncoded
      bodyText : historyObj.bodyText, //Used in case of JSON, XML, Other
      headers : historyObj.headers,
      formParams : historyObj.formParams,
      response : historyObj.response
    }
    db.history.insert(data, function (err, newDoc) {
        console.log('Added to history : ' + historyObj)
        callback(newDoc);
    });
  },

  removeFromHistory : function(historyId, callback) {
    db.history.remove({_id : historyId}, {}, function (err, numRemoved) {
      console.log('Removed from history : ' + historyId)
      callback(err, numRemoved);
    });
  },

  updateResponseToHistory : function(historyId, responseObj) {
    db.history.update({_id: history}, { $set : {response : responseObj}}, {}, function(err, numAffected, affectedDocuments, upsert){
      console.log('response updated to history : ' + historyId)
    })
  },

  getParentCollectionById : function(collectionId, callback) {
		db.collection.findOne({_id : collectionId, parent : null}, function (err, doc) {
      callback(err, doc);
		});
	},

  getCollectionById : function(collectionId, callback) {
		db.collection.findOne({_id : collectionId}, function (err, doc) {
      callback(err, doc);
		});
	},

  getSearchResults : function(searchText, callback) {
		var res = [];
		db.collection.find({name : RegExp(searchText, "i")}, function (err, doc) {
			res = doc;
			for (var i in res) {
				res[i].isTypeCollection = true;
			}
			db.request.find( {$or: [{ "name" : RegExp(searchText, "i") },{ "uri" : RegExp(searchText, "i") }]}, function (err, docs) {
				callback(err,res.concat(docs));
			});
		});
  } ,


  //Auth Request

	addAuthRequest : function(authObj, callback) {
		db.authorizations.insert(authObj, function (err, newDoc) {
			callback(err, newDoc);
		});
	},
	deleteAuthRequest: function(authReqId, callback) {
		db.authorizations.remove({_id : authReqId}, {}, function (err, numRemoved) {
			console.log('Removed auth request : ' + authReqId);
			callback(err,numRemoved);
		});
	},
	updateAuthRequest: function (authReqObj, callback) {
		db.authorizations.update({_id: authReqId._id}, authReqObj, {returnUpdatedDocs: true}, function(err, numAffected, affectedDocuments, upsert){
				callback(affectedDocuments);
		})
	},
	getAllAuthRequest: function (callback) {
		db.authorizations.find({},function(err, docs){
			console.log(err)
			callback(err,docs);
		})
	}
}
