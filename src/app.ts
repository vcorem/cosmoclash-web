const mode = new URLSearchParams(window.location.search).get("mode");
if (mode === "melee") {
  void import("./main");
} else {
  void import("./campaign/entry");
}
