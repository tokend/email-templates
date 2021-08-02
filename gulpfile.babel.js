import gulp     from 'gulp';
import plugins  from 'gulp-load-plugins';
import browser  from 'browser-sync';
import rimraf   from 'rimraf';
import panini   from 'panini';
import yargs    from 'yargs';
import lazypipe from 'lazypipe';
import inky     from 'inky';
import fs       from 'fs';
import siphon   from 'siphon-media-query';
import rename   from 'gulp-rename'

const $ = plugins();

const PROJECTSNAME = yargs.argv.projectname;
let BUILDALL = false;
let BUILDDEV = false;
let BUILDSTAGE = false;
let BUILDPROD = false;

gulp.task('default', gulp.series(checkEnvironment, reset, pages, sass, inline, clean, release, server, watch));

function checkEnvironment (done) {
  if (yargs.argv.environment === 'dev') {
    BUILDDEV = true
  }
  if (yargs.argv.environment === 'all') {
    BUILDALL = true
  }
  if (yargs.argv.environment === 'prod') {
    BUILDPROD = true
  }
  if (yargs.argv.environment === 'stage') {
    BUILDSTAGE = true
  }
  if (yargs.argv.environment + '' === 'true') {
    BUILDALL = true
  }
  done()
}

function reset(done) {
  rimraf('builder/' + PROJECTSNAME + '/dist', done);
}

function resetPages(done) {
  panini.refresh();
  done();
}

function clean (done) {
  rimraf('builder/' + PROJECTSNAME + '/dist/css', done);
  rimraf('templates/' + PROJECTSNAME + '/pages', done);
  if(BUILDALL || BUILDDEV) rimraf('templates/' + PROJECTSNAME + '/dev', done);
  if(BUILDALL || BUILDSTAGE) rimraf('templates/' + PROJECTSNAME + '/stage', done);
  if(BUILDALL || BUILDPROD) rimraf('templates/' + PROJECTSNAME + '/prod', done);
}

// Compile layouts, pages, and partials into flat HTML files
// Then parse using Inky templates
function pages() {
  return gulp.src(['builder/' + PROJECTSNAME + '/pages/**/*.html'])
  .pipe(panini({
    root: 'builder/' + PROJECTSNAME + '/pages',
    layouts: 'builder/layouts',
    partials: 'builder/' + PROJECTSNAME + '/partials'
  }))
  .pipe(inky())
  .pipe(gulp.dest('builder/' + PROJECTSNAME + '/dist'));
}

// Compile Sass into CSS
function sass() {
  return gulp.src('builder/' + PROJECTSNAME + '/scss/app.scss')
  .pipe($.sass({
    includePaths: ['node_modules/foundation-emails/scss']
  }).on('error', $.sass.logError))
  .pipe( $.uncss(
    {
      html: ['builder/' + PROJECTSNAME + '/dist/**/*.html']
    }))
  .pipe(gulp.dest('builder/' + PROJECTSNAME + '/dist/css'));
}

// Inline CSS and minify HTML
function inline() {
  return gulp.src(['builder/' + PROJECTSNAME + '/dist/**/*.html'])
  .pipe(inliner('builder/' + PROJECTSNAME + '/dist/css/app.css'))
  .pipe(gulp.dest('builder/' + PROJECTSNAME + '/dist'));
}

function release () {
  return gulp.src(['builder/' + PROJECTSNAME + '/dist/*.html'])
  .pipe(gulp.dest('pages'))
  .pipe(rename(function (path) { path.extname = "" }))
  .pipe($.if(BUILDALL || BUILDDEV, gulp.dest('templates/' + PROJECTSNAME + '/dev')))
  .pipe($.if(BUILDALL || BUILDSTAGE, gulp.dest('templates/' + PROJECTSNAME + '/stage')))
  .pipe($.if(BUILDALL || BUILDPROD, gulp.dest('templates/' + PROJECTSNAME + '/prod')));
}

// Start a server with LiveReload to preview the site in
function server(done) {
  browser.init({
    server: 'builder/' + PROJECTSNAME + '/dist'
  });
  done();
}

// Watch for file changes
function watch() {
  gulp.watch('builder/' + PROJECTSNAME + '/**/pages/**/*.html').on('all', gulp.series(pages, inline, browser.reload));
  gulp.watch(['builder/layouts/**/*', 'builder/' + PROJECTSNAME + '/partials/**/*']).on('all', gulp.series(resetPages, pages, inline, browser.reload));
  gulp.watch(['builder/' + PROJECTSNAME + '/scss/**/*.scss']).on('all', gulp.series(resetPages, sass, pages, inline, browser.reload));
}

// Inlines CSS into HTML, adds media query CSS into the <style> tag of the email, and compresses the HTML
function inliner(css) {
  var css = fs.readFileSync(css).toString();
  var mqCss = siphon(css);

  var pipe = lazypipe()
  .pipe($.inlineCss, {
    applyStyleTags: false,
    removeStyleTags: true,
    preserveMediaQueries: true,
    removeLinkTags: false
  })
  .pipe($.replace, '<!-- <style> -->', `<style>${mqCss}</style>`)
  .pipe($.replace, '<link rel="stylesheet" type="text/css" href="css/app.css">', '')
  .pipe($.htmlmin, {
    collapseWhitespace: true,
    minifyCSS: true
  });

  return pipe();
}
