#!/bin/sh
# signs a schedule daemon with the one local identity, so its tcc grant pins to the certificate and survives
# every rebuild; an ad-hoc signature pins to the cdhash, and the next source change silently drops the grant.
# usage: script/lib/sign.sh <binary> — the identifier is com.dima.<binary name>, the job's own name.
# no ad-hoc fallback on purpose: a missing identity fails the build instead of shipping a grant-losing binary.
set -eu
codesign --force --sign 'x-speak local signing' --identifier "com.dima.$(basename "$1")" "$1"
