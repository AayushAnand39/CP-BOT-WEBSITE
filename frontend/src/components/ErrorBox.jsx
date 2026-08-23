export default function ErrorBox({
  error
}) {
  if (!error) return null;

  const message =
    error.response?.data?.message ||
    error.message ||
    "Something went wrong";

  return (
    <div className="error-box">
      {message}
    </div>
  );
}
