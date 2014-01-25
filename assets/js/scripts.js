$(document).ready(function() {
  $('a.menu').click(function() {
    $('.site-header nav').slideToggle(100);
    return false;
  });

  $(window).resize(function(){
    var w = $(window).width();
    var menu = $('.site-header nav');
    if(w > 680 && menu.is(':hidden')) {
      menu.removeAttr('style');
    }
  });

  $('article.post iframe').wrap('<div class="video-container" />');
});

$(function(){
  $('.post-list li').each(function(i){
    var t = $(this);
    setTimeout(function(){ t.addClass('slider'); }, (i+1) * 330);
  });
});
