export const CommitDiff = ({ commit }: { commit: Commit }) => {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gray-900 text-white">
        <h2 className="text-lg font-semibold">Commit Diff</h2>
        <p className="text-sm text-gray-400">{commit.oldHash} → {commit.newHash}</p>
      </div>

      {/* Main content - ensure it takes full height and doesn't get centered */}
      <div className="flex-1 overflow-auto min-h-0 bg-black">
        {/* File list and diff viewer */}
        <div className="flex h-full">
          <FileList />
          <DiffViewer />
        </div>
      </div>
    </div>
  );
};