/**
 * ProtoDo - A Cloud-based task manager using ProotoAPI
 */

// Imports
$script( 'https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js', 'jquery' );
$script( 'lib/jquery.validate.js', 'validate' );
$script( 'lib/jquery.infieldlabel.min.js', 'infieldlabel' );
$script( 'lib/protoapi.js', 'protoapi' );

// App module
$script.ready( [ 'jquery', 'validate', 'infieldlabel', 'protoapi' ], function($){
	return function(){

		/** 
		 * Task is a warper around the document we save to ProtoAPI. 
		 * We can easily handle conversions here but since we can store anything
		 * into ProtoAPI backend we don't require much conversions
		 */
		var Task = function( data, notes, done ){
			if( typeof data === 'object' ){
				this.document = data;
			} else {
				var $done = done ? done : false;
				this.document = {
					title: data,
					done: $done,
					notes: notes,
				};
			}
		}
		Task.prototype = {
			setDone: function( value ){
				this.document.done = value;
			},
			getDone: function(){
				return this.document.done;
			},
			setTitle: function( value ){
				this.document.title = value;
			},
			getTitle: function(){
				return this.document.title;
			},
			setNotes: function( value  ){
				this.document.notes = value;
			},
			getNotes: function(){
				return this.document.notes;
			},
			setDate: function( value ){
				// Right now protoapi.js doesn't do this conversion for us
				if( typeof value === 'object' )
					value = value.toISOString();

				this.document.date = value;	
			},
			getDate: function(){
				if( typeof this.document.date !== 'undefined')
					return new Date(this.document.date);	
				return undefined;
			},
			getDocument: function(){
				return this.document;
			}
		};


		/**
		 * TasksView is our 'view' in this little app.
		 * It handles all DOM interaction using jQuery for simplicity
		 */
		var TasksView = function( ctrl ){
			this.ctrl = ctrl;

			this.__buildInitialInterface();
		}
		TasksView.prototype = {
			/** Interanl mothod for initial setup of event handlers */
			__buildInitialInterface: function(){
				$('#newtask').keypress(this.onKeyPressAtTitleInput.bind(this));
			},
			/** Event handler for new task input */
			onKeyPressAtTitleInput: function( event ){
				if( event.which == 13 ) {
     				event.preventDefault();
					var value = $( '#newtask' ).val();
					this.ctrl.onAddTask( value );
				}
			},
			/** Handles click on a task. Currently does nothing. */
			onTaskClick: function( event ){
				this.ctrl.onTaskClick()
			},
			/** Clear task input from any text */
			clearInput: function(){
				$('#newtask').val('');
			},
			/** Add a new task on top of other */
			addNewTaskOnTop: function( title, date, remove_cb, taskclick_cb, taskdone_cb ){

				var done_button = $( '<span class="done_button"></span>' ).click(function(){
					$( this ).parent().parent().fadeToggle( 'fast' );
					taskdone_cb();
					return false;
				});

				var delete_button = $( '<span class="delete_button"></span>' ).click(function(){
					$( this ).parent().parent().fadeToggle( 'fast' );
					remove_cb();
					return false;
				});

				var container = $('<div class="task_inner"></div>')
					.append( done_button )
					.append( '<h3><div>' + title + '</div></h3>' )
					.append( delete_button )
					.append( '<h4><div>' + date + '</div></h4>' );
					

				var item = $( '<li class="task"></li>' )
					.click( function(){ taskclick_cb(); return false; } )
					.append( container )
					.prependTo( '#tlist' );
			}
		}

		/** TasksManager acts as our controller/domain */
		var TasksManager = function( appid, appkey, userid ){
			// Register a handy 'bind' function to Function's prototype which warps 'this' nicely
			this.__registerBind();

			this.appid = appid;
			this.appkey = appkey;
			this.userid = userid;
			this._tasks = [];
			this.view = new TasksView( this );

			// Configure protoapi.js
			protoapi( { 
				appid: '4f2ebbc700ac0fd23a00005e', 
				appkey: 'ed756d6c2b62eecc9dcfcbeaf517edfb',
				apiuri: 'http://localhost/api/1/objects/' // It's great to have ProtoAPI at localhost ;)
			} );

			this.fetchFromCloud();
		}
		TasksManager.prototype = {
			/** Fetch data from ProtoAPI backend */
			fetchFromCloud: function(){
				protoapi( 'todos' ).get( { done: false }, this.onFetchedData.bind(this) );
			},
			/** Event handler called once the data is ready to be used */
			onFetchedData: function( response ){
				for( key in response.data ){
					this.onAddTask( response.data[ key ], true );
				}
			},
			/** 
			 * Adds a new tasks to the list. 
			 *
			 * This fires a post or put to ProtoAPI and a new task view is added.
			 * Date is set to now before saving. We use protoapi.js's save method so
			 * that we can forget about handling creation or updates of data.
			 *
			 * @param data: task document (what is save to ProtoAPI).
			 * @param avoid_save: if true, we treat this task as coming from ProtoAPI 
			 *					  so we don't need to re-save it again.
			 */
			onAddTask: function( data, avoid_save ){
				var task = new Task( data );
				this._tasks.unshift( task );

				var date = task.getDate();
				if( typeof date !== 'object' )
					date = 'Just now';
				else
					date = date.toLocaleDateString();
				
				this.view.clearInput();
				this.view.addNewTaskOnTop( 
					task.getTitle(), 
					date,
					this.onTaskRemove.bind(this, task), // Callback when user removes the task from list
					this.onTaskClick.bind(this, task),
					this.onTaskDone.bind(this, task) // Callback when user presses done button
				);

				if( !avoid_save ){
					task.setDate( new Date() );
					protoapi( 'todos' ).save( task.getDocument() );
				}
			},
			/** Called by our View when user presses remove button on a task */
			onTaskRemove: function( task ){
				var index = this._tasks.indexOf( task );
				this._tasks.splice( index, 1 );
				protoapi( 'todos' ).delete( { _id: task.getDocument()._id } );
			},
			/** Called by our View when user presses the 'done' button */
			onTaskDone: function( task ){
				task.setDone( true );

				protoapi( 'todos' ).save( task.document );
			},
			onTaskClick: function( task ){
				
			},
			__registerBind: function(){
				if (!Function.prototype.bind) { // check if native implementation available
					Function.prototype.bind = function(){ 
				    	var fn = this, args = Array.prototype.slice.call(arguments),
				        	object = args.shift(); 
				    	return function(){ 
				      		return fn.apply(object, 
				        	args.concat(Array.prototype.slice.call(arguments))); 
				    	}; 
				  	};
				}
			},
		};

		var manager_instance = new TasksManager();

	}}(jQuery)
);