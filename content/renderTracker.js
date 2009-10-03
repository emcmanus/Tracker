var rendertracker = function(){
	this.context = null;
};

rendertracker.prototype = {
	initialize: function( context )
	{
		this.context = context;
		// ...
	}
}