package main

// the one door from core to an add-on, filled at the add-on's init; its zero value is the plain flow
var laneAddOn struct {
	// the branch a pr opens onto; "" keeps main
	prBase func(Flags) (string, error)
	// the layers a pr merges with; nil for a plain pr
	layersOf func(repo, n string, pr pullHead) (*prLayers, error)
	// lands a pr and every layer below it in one call
	mergeLayers func(repo, n, head string) (merged, sha string, err error)
	// one line per layer of the stack a pr tops, bottom-up: its pr, head and base
	stackShown func(repo, n string) ([]string, error)
	// its verb lists beside registry.json, for the held lint
	registries []string
}

// a pr that merges together with the layers under it
type prLayers struct {
	trunk string   // where every layer lands
	below []string // the open layers under the pr, bottom-up
	wait  string   // why it cannot merge now; "" lets the checks decide
}
