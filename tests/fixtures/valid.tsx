import { Button } from "./Button";
import { TextInput } from "./TextInput";
import { colors, spacing } from "./tokens";

export default function ValidForm() {
  return (
    <form>
      <TextInput
        type="text"
        placeholder="Enter your name"
        style={{ marginBottom: spacing[3] }}
      />
      <Button
        onClick={() => console.log("submit")}
        style={{ marginTop: 16, padding: 8, color: colors.primary }}
      >
        Submit
      </Button>
    </form>
  );
}
