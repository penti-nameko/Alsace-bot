-- CreateTable
CREATE TABLE "gitHubRepo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "gitHubRepo_owner_repo_key" ON "gitHubRepo"("owner", "repo");
