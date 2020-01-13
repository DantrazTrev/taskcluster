package main

import (
	"github.com/taskcluster/taskcluster/workers/generic-worker/generic-worker/process"
)

func (cot *ChainOfTrustTaskFeature) catCotKeyCommand() (*process.Command, error) {
	return process.NewCommand([]string{"cmd.exe", "/c", "type", config.Ed25519SigningKeyLocation}, cwd, nil, taskContext.pd)
}
