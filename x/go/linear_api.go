package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// an FRM-N literal where linear wants an id: a uuid-only mutation (issueArchive) gets the uuid
var idPosition = regexp.MustCompile(`\b(id|issueId|relatedIssueId|parentId)(\s*:\s*)"([A-Z]+-\d+)"`)

// linearAPI is the raw door: any graphql under the caller's identity, linear's reply printed as it came
func linearAPI(r *Run, args []string, flags Flags) (any, error) {
	query := args[0]
	vars := map[string]any{}
	if raw, _ := flags["vars"].(string); raw != "" {
		if err := json.Unmarshal([]byte(raw), &vars); err != nil {
			return nil, usageFail("--vars takes a json object: "+err.Error(), `x linear api '<graphql>' --vars '{"id":"FRM-1"}'`)
		}
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	traced.Shape = shapeOf(query)

	var ids []string
	for _, at := range idPosition.FindAllStringSubmatchIndex(query, -1) {
		if !takesIdentifier(query[:at[0]]) {
			ids = append(ids, query[at[6]:at[7]])
		}
	}
	eachIDVar(vars, func(text string) string {
		if ticketShape.MatchString(text) {
			ids = append(ids, text)
		}
		return text
	})
	slices.Sort(ids)
	ids = slices.Compact(ids)
	if len(ids) > 0 {
		uuids, err := lookupUUIDs(actor, ids)
		if err != nil {
			return nil, err
		}
		var rewritten strings.Builder
		last := 0
		for _, at := range idPosition.FindAllStringSubmatchIndex(query, -1) {
			if takesIdentifier(query[:at[0]]) {
				continue
			}
			rewritten.WriteString(query[last:at[6]-1] + strconv.Quote(cmpOrKey(uuids, query[at[6]:at[7]])))
			last = at[7] + 1
		}
		query = rewritten.String() + query[last:]
		eachIDVar(vars, func(text string) string { return cmpOrKey(uuids, text) })
	}

	raw, status, err := post(actor, query, vars)
	if status == http.StatusUnauthorized {
		forget(actor, "linear")
		raw, status, err = post(actor, query, vars)
	}
	if err != nil {
		return nil, err
	}
	var reply struct {
		Errors []gqlError `json:"errors"`
	}
	_ = json.Unmarshal(raw, &reply)
	out := bytes.TrimSpace(raw)
	if r.human {
		var pretty bytes.Buffer
		if json.Indent(&pretty, out, "", "  ") == nil {
			out = pretty.Bytes()
		}
	}
	_, _ = os.Stdout.Write(append(out, '\n'))
	r.passthrough = true
	if len(reply.Errors) > 0 || status >= 400 {
		r.code = 1
		traced.Kind = "external"
	}
	return nil, nil
}

// `issue(id: "FRM-1")` — the 583 measured single reads — takes the identifier as it is; no lookup.
// a match that starts inside a string (a comment body, a """block""") is text, never an id position
func takesIdentifier(before string) bool {
	return insideString(before) || strings.HasSuffix(strings.TrimRight(before, " \t\r\n"), "issue(")
}

// insideString scans graphql up to the end of text: true when text ends inside "…" or """…"""
func insideString(text string) bool {
	for i := 0; i < len(text); i++ {
		switch {
		case strings.HasPrefix(text[i:], `"""`):
			// a block string ends at the first """ that is not escaped as \"""
			j := i + 3
			for j < len(text) && !(strings.HasPrefix(text[j:], `"""`) && text[j-1] != '\\') {
				j++
			}
			if j >= len(text) {
				return true
			}
			i = j + 2
		case text[i] == '"':
			j := i + 1
			for ; j < len(text) && text[j] != '"'; j++ {
				if text[j] == '\\' {
					j++
				}
			}
			if j >= len(text) {
				return true
			}
			i = j
		}
	}
	return false
}

// eachIDVar hands every id-keyed string variable to swap, inside nested input objects too
func eachIDVar(vars map[string]any, swap func(string) string) {
	for key, value := range vars {
		switch v := value.(type) {
		case string:
			if key == "id" || strings.HasSuffix(key, "Id") {
				vars[key] = swap(v)
			}
		case map[string]any:
			eachIDVar(v, swap)
		}
	}
}

func cmpOrKey(found map[string]string, id string) string {
	if uuid := found[id]; uuid != "" {
		return uuid
	}
	return id
}

// lookupUUIDs answers every ticket id with its uuid in one request; an id linear lacks stays as written
func lookupUUIDs(actor string, ids []string) (map[string]string, error) {
	var params, fields []string
	vars := map[string]any{}
	for i, id := range ids {
		alias := "a" + strconv.Itoa(i)
		params = append(params, "$"+alias+": String!")
		fields = append(fields, alias+": issue(id: $"+alias+") { id }")
		vars[alias] = id
	}
	data, _, err := gql(actor, "query x_lookup("+strings.Join(params, ", ")+") { "+strings.Join(fields, " ")+" }", vars)
	if err != nil {
		return nil, err
	}
	uuids := map[string]string{}
	for i, id := range ids {
		var issue struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(data["a"+strconv.Itoa(i)], &issue) == nil && issue.ID != "" {
			uuids[id] = issue.ID
		}
	}
	return uuids, nil
}

// shapeOf names what a query asks for without a word of its text: the operation kind and its
// top-level field names (aliases resolved), sorted — `query comments,issue`
func shapeOf(query string) string {
	kind := "query"
	trimmed := strings.TrimSpace(query)
	for strings.HasPrefix(trimmed, "#") {
		_, trimmed, _ = strings.Cut(trimmed, "\n")
		trimmed = strings.TrimSpace(trimmed)
	}
	for _, k := range []string{"mutation", "subscription", "query"} {
		if strings.HasPrefix(trimmed, k) {
			kind = k
		}
	}
	var fields []string
	braces, parens := 0, 0
	inString := false
	for i := 0; i < len(query); i++ {
		c := query[i]
		switch {
		case inString:
			if c == '\\' {
				i++
			} else if c == '"' {
				inString = false
			}
		case c == '"':
			inString = true
		case c == '#':
			for i < len(query) && query[i] != '\n' {
				i++
			}
		case c == '{':
			braces++
		case c == '}':
			braces--
		case c == '(':
			parens++
		case c == ')':
			parens--
		case braces == 1 && parens == 0 && strings.HasPrefix(query[i:], "..."):
			// a spread (`...Name`) or an inline fragment (`... on Type`) is no field of its own
			j := i + 3
			for range 2 {
				for j < len(query) && (query[j] == ' ' || query[j] == '\n' || query[j] == '\t') {
					j++
				}
				start := j
				for j < len(query) && isNamePart(query[j]) {
					j++
				}
				if query[start:j] != "on" {
					break
				}
			}
			i = j - 1
		case braces == 1 && parens == 0 && isNameStart(c):
			j := i
			for j < len(query) && isNamePart(query[j]) {
				j++
			}
			name := query[i:j]
			k := j
			for k < len(query) && (query[k] == ' ' || query[k] == '\t' || query[k] == '\n' || query[k] == '\r') {
				k++
			}
			// `a: issue` — the alias is the caller's word; the field after it is the shape
			if (k == len(query) || query[k] != ':') && !slices.Contains(fields, name) {
				fields = append(fields, name)
			}
			i = j - 1
		}
	}
	slices.Sort(fields)
	return fmt.Sprintf("%s %s", kind, strings.Join(fields, ","))
}

func isNameStart(c byte) bool { return c == '_' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' }
func isNamePart(c byte) bool  { return isNameStart(c) || c >= '0' && c <= '9' }
