#!/bin/sh

#this script takes the platform-src/.config file and enables building:
# * package/gargoyle-i18n
# * the target language specified to make (default is English-EN)
#
# NOTE: 1 & only 1 target language is supported via this script
# only target languages that are commented out are worked upon. Example:
#			"# CONFIG_PACKAGE_plugin-gargoyle-i18n-SignLanguage-SL is not set"
# this allows some intrepid users to build firmware with 2 or more languages enabled ***BEFORE*** this script gets to modding
#
# NOTE2: this script method does not support a language not present in the config file (perhaps freshly added) - the python script does

target_dir="$1"
target_lang="$2"
top_dir=$(dirname $(dirname "$0"))

echo "Using shell script to set i18n language"

touch "$top_dir/$target_dir/.config2"

awk -F'\n' -v lng="$target_lang" '/^# CONFIG_PACKAGE_gargoyle-i18n/ { $1=substr($1, 3, length($1)-13)"=y"; }; /^# CONFIG_PACKAGE_plugin-gargoyle-i18n/ { bld=match($1,lng)?"y":"m"; $1=substr($1, 3, length($1)-13)"="bld; }; { print $1 };' "$top_dir/$target_dir/.config" >> "$top_dir/$target_dir/.config2"

mv "$top_dir/$target_dir/.config2" "$top_dir/$target_dir/.config"
