var
  yaml = require('js-yaml'),
  path = require('path'),
  fs = require('fs'),
  _ = require('lodash'),
  mustache = require('mustache'),
  args = {},
  // Input from languages.yml.
  lang_data,
  // Processed language data.
  languages = {},
  // Data about language groups.
  groups = {},
  // Sorted array of languages.
  sequence,
  // Rendered output.
  content = [],
  // Functions to apply to language data in successive passes.
  passes = [],
  encoding = 'utf8',
  paths = {output: {dir: 'dist', file: 'languages.md'}};

process.argv.slice(2).forEach(function (arg) {
  var matches = arg.match(/--([^=]+)=([^ ]+)/);
  args[matches[1]] = matches[2];
});

if (! args['linguist-version']) {
  throw "You must specify linguist version";
}

paths.lang_yml =
  args['lang-yml-path'] || './linguist/lib/linguist/languages.yml';

lang_data = yaml.safeLoad(fs.readFileSync(paths.lang_yml, encoding));

// Get case-insensitive sort of top level keys (language names).
sequence = Object.keys(lang_data).sort(function (a, b) {
  var ret = 0;
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a < b) {
    ret = -1;
  }
  else if (a > b) {
    ret = 1;
  }
  return ret;
});

// Compile language data.
sequence.forEach(function (key) {
  var
    lang = lang_data[key],
    group = lang.group || key;

  function lc (val) {
    return val.toLowerCase();
  }

  function despace (val) {
    return val.replace(/ /g, "-");
  }

  languages[key] = {
    key: key,
    label: key,
    group: group,
    // Do not include group name here, it's not always applicable. For example,
    // see "Ecere Projects". Its group is "JavaScript", but it has special
    // highlighting.
    ids: _.union(
      [
        despace(lc(key)),
      ],

      (lang.aliases || [])
        .filter(function (el) {
          return el.indexOf(" ") === -1;
        })
        .map(lc),

      (lang.extensions || [])
        .map(lc).map(function (val) {
          // Extract name without leading "."
          return val.match(/([^.].*)/)[1];
        })
    ).sort()
  };

  // To accumulate ids for groups
  groups[group] = groups[group] || {ids: []};
});

// Retrieve template.
function get_template (id) {
  return fs.readFileSync('./src/templates/' + id, 'utf8');
}

// Render template.
function render (template, context) {
  template = get_template(template);
  return mustache.render.apply(mustache, [template, context]);
}

// Accumulate ids per group.
passes.push(function (item) {
  var group = groups[item.group];
  group.ids = _.union(group.ids, item.ids).sort();
});

// Render content for language.
passes.push(function (item) {
  content.push(render('language', item));
});

passes.forEach(function (handler) {
  sequence.forEach(function (name) {
    handler(languages[name]);
  });
});

content = render('languages', {languages: content});
content = render('page', {
  languages: content,
  linguist_version: args['linguist-version'],
});

try {
  fs.mkdirSync('./' + paths.output.dir, '0755');
}
catch (e) {}

fs.writeFileSync(
  './' + path.join(paths.output.dir, paths.output.file),
  content,
  {encoding: encoding}
);
