(function(SFDC) {

    var viewProps = {
        sobject: null,
        recordid: null,
        fieldlist: null,
        idfield: "Id",
        autosync: true,
        mergemode: Force.MERGE_MODE.OVERWRITE
    };

    var createModel = function(sobject) {
        return new (Force.SObject.extend({
            cacheMode: SFDC.cacheMode,
            sobjectType: sobject,
        }));
    }

    var SObjectViewModel = function(model) {
        var _self = this;

        var setupProps = function(props) {
            props.forEach(function(prop) {
                Object.defineProperty(_self, prop, {
                    get: function() {
                        return model.get(prop);
                    },
                    set: function(val) {
                        model.set(prop, val);
                    },
                    enumerable: true
                });
            });
        }
        setupProps(_.keys(model.attributes));

        // Setup an event listener to update properties whenever model attributes change
        model.on('change', function() {
            setupProps(_.difference(_.keys(model.attributes), _.keys(_self)));
        });
    }

    Polymer('force-sobject', _.extend({}, viewProps, {
        observe: {
            sobject: "propertyChanged",
            recordid: "propertyChanged",
            fieldlist: "propertyChanged",
            idfield: "propertyChanged",
            autosync: "propertyChanged"
        },
        propertyChanged: function() {
            this.init();
            if (this.autosync) this.fetch();
        },
        // Resets all the properties on the model.
        // Recreates model if sobject type or id of model has changed.
        init: function(reset) {
            var model = this._model;
            if (reset || typeof model == "undefined" ||
                model.sobjectType != this.sobject ||
                (model.id && model.id != this.recordid)) {
                model = this._model = createModel(this.sobject);
                this.fields = new SObjectViewModel(model);
            }
            model.fieldlist = this.fieldlist;
            model.idAttribute = this.idfield;
            model.set(this.idfield, this.recordid);
            model.set({attributes: {type: this.sobject}});
        },
        // All CRUD operations should ensure that the model is ready by checking this promise.
        whenModelReady: function() {
            var model = this._model;
            var store = this.$.store;

            this.init();
            return $.when(store.cacheReady, SFDC.launcher)
                .then(function() {
                    model.cache = store.cache;
                    model.cacheForOriginals = store.cacheForOriginals;
                });
        },
        ready: function() {
            this.init();
            if (this.autosync) this.fetch();
        },
        fetch: function(opts) {
            var model = this._model;
            if (model.sobjectType && model.id) {
                this.whenModelReady().then(function() {
                    model.fetch(opts);
                });
            } else console.warn('sobject Type and recordid required for fetch.');

            return this;
        },
        save: function(options) {
            var model = this._model;
            options.mergeMode = options.mergeMode || this.mergemode;
            if (model.sobjectType) {
                this.whenModelReady().then(function() {
                    // Perform save (upsert) against the server
                    model.save(null, options);
                });
            } else console.warn('sobject Type required for save.');
        },
        delete: function(options) {
            var model = this._model;
            options.mergeMode = options.mergeMode || this.mergemode;
            if (model.sobjectType && model.id) {
                this.whenModelReady().then(function() {
                    // Perform delete of record against the server
                    this._model.destroy(options);
                });
            } else console.warn('sobject Type and recordid required for delete.');
        },
        set: function(key, val) {
            this._model.set(key, val);
        },
        get: function(key) {
            return this._model.get(key);
        }
    }));

})(window.SFDC);
