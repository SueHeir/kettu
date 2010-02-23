Torrents = function(transmission) { with(transmission) {
  var context;
  
  get('#/torrents', function() {
    context = this;
    transmission.sort_mode = this.params['sort'] || transmission.sort_mode || 'name';
    transmission.view_mode = this.params['view'] || transmission.view_mode || 'normal';

    getAndRenderTorrents(this.params['view'] || this.params['sort']);
    if(transmission.interval_id) { clearInterval(transmission.interval_id); }
    transmission.reload_interval = 8000;
    transmission.interval_id = setInterval('getAndRenderTorrents()', transmission.reload_interval);
  });
  
  get('#/torrents/new', function() {
    context = this;
    this.partial('./templates/torrents/new.mustache', {}, function(rendered_view) {
      context.openInfo(rendered_view);
    });
  });
  
  route('delete', '#/torrents/:id', function() {
    context = this;
    var request = {
      'method': 'torrent-remove',
      'arguments': {'ids': parseInt(this.params['id'])}
    };
    context.remote_query(request, function(response) {
      context.trigger('flash', 'Torrent removed successfully.');
    });
  });
  
  post('#/torrents', function() {
    context = this;
    var paused = (this.params['start_when_added'] != "on");
    if(this.params['url'].length > 0) {
      var request = {
        'method': 'torrent-add',
        'arguments': {'filename': this.params['url'], 'paused': paused}
      };
      context.remote_query(request, function(response) {
        torrentUploaded(response['torrent-added']);
      });      
    } else {
      $('#add_torrent_form').ajaxSubmit({
    		'url': remote_url + '/transmission/upload?paused=' + paused,
    		'type': 'POST',
    		'data': { 'X-Transmission-Session-Id' : remote_session_id },
    		'dataType': 'xml',
        'iframe': true,
    		'success': function(response) {
    		  torrentUploaded($(response).children(':first').text().match(/200/));
    		}
  		});
    }    
  });
  
  get('#/torrents/:id', function() {
    context = this;
    var id = parseInt(context.params['id']);
    
    getTorrent(id, function(torrent) {
      context.partial('./templates/torrents/show_info.mustache', TorrentView(torrent, context), function(rendered_view) {
        context.openInfo(rendered_view);
        context.startCountDownOnNextAnnounce();
      });
    });
  });
  
  put('#/torrents/:id', function() {
    context = this;
    var id = parseInt(context.params['id']);
    var request = {
      'method': context.params['method'],
      'arguments': {'ids': id}
    };
    context.remote_query(request, function(response) {
      getTorrent(id, renderTorrent);
    });
  });
  
  getTorrent = function(id, callback) {
    var request = {
      'method': 'torrent-get',
      'arguments': {'ids': id, 'fields': Torrent({})['fields'].concat(Torrent({})['info_fields'])}
    };
    context.remote_query(request, function(response) {
      if(callback) {
        callback(response['torrents'].map( function(row) {return Torrent(row);} )[0]);
      }
    });
  }
    
  renderTorrent = function(torrent) {
    context.partial('./templates/torrents/show.mustache', TorrentsView(torrent, context), function(rendered_view) {
      $(element_selector).find('#' + torrent.id).replaceWith(rendered_view);
      trigger('torrent-refreshed', torrent);
    });    
  };
  
  getAndRenderTorrents = function(need_change) {
    var request = {
      method: 'torrent-get',
      arguments: {fields:Torrent({})['fields']}
    };
    context.remote_query(request, function(response) {
      var torrents = response['torrents'].map( function(row) {return Torrent(row)} );
      trigger('torrents-refreshed', {"torrents": torrents, "need_change": need_change});
    });    
  };
  
  torrentUploaded = function(torrent_added) {
    var message = (torrent_added) ? 'Torrent added successfully.' : 'Torrent could not be added.';
    context.trigger('flash', message);
    context.closeInfo();
    getAndRenderTorrents();
  };
  
  bind('torrents-refreshed', function(e, params) { with(this) {
    this.updateViewElements(this.sortTorrents(transmission.sort_mode, params['torrents']), params['need_change']);
  }});
  
  bind('torrent-refreshed', function(e, torrent) { with(this) {
    this.updateInfo(torrent);
    this.cycleTorrents();    
  }});
}};