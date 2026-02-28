export default function BadComponent() {
  return (
    <div
      onClick={() => console.log("clicked")}
      style={{
        color: "#FF0000",
        backgroundColor: "rgb(0, 0, 255)",
        marginTop: 18,
        padding: 13,
      }}
    >
      <span onPress={() => {}} style={{ fill: "red" }}>
        bad text
      </span>
      <input type="text" style={{ marginLeft: "7px" }} />
    </div>
  );
}
