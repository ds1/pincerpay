import { select, input, confirm } from "@inquirer/prompts";
import { execSync } from "node:child_process";
import { readContent, moveContent, updateBody } from "../../lib/content-store.js";
import { generateContent, reviewContent } from "../../lib/claude.js";
import { composeSystemPrompt, loadReviewPrompt } from "../../lib/prompt-loader.js";
import { log } from "../../lib/logger.js";
import { formatContentPreview } from "./formatters.js";
import type { ContentFile, ReviewAction } from "../../types/index.js";

export async function reviewContentInteractive(items: ContentFile[]): Promise<void> {
  if (items.length === 0) {
    log.info("No drafts to review.");
    return;
  }

  log.header(`Reviewing ${items.length} draft(s)`);

  let reviewed = 0;
  let approved = 0;
  let rejected = 0;

  for (const item of items) {
    console.log();
    console.log(formatContentPreview(item));
    console.log();

    const action = await promptReviewAction();

    switch (action.type) {
      case "approve": {
        moveContent(item.filepath, "approved");
        log.success(`Approved: ${item.frontmatter.id}`);
        approved++;
        break;
      }

      case "edit": {
        await openInEditor(item.filepath);
        // Re-read after edit
        const edited = readContent(item.filepath);
        console.log();
        console.log(formatContentPreview(edited));
        const postEditAction = await select({
          message: "After editing:",
          choices: [
            { name: "Approve", value: "approve" },
            { name: "Keep as draft", value: "keep" },
            { name: "Reject", value: "reject" },
          ],
        });
        if (postEditAction === "approve") {
          moveContent(item.filepath, "approved");
          log.success(`Approved (after edit): ${item.frontmatter.id}`);
          approved++;
        } else if (postEditAction === "reject") {
          const reason = await input({ message: "Rejection reason:" });
          moveContent(item.filepath, "rejected", { rejection_reason: reason });
          log.warn(`Rejected: ${item.frontmatter.id}`);
          rejected++;
        }
        break;
      }

      case "reject": {
        const reason = await input({ message: "Rejection reason:" });
        moveContent(item.filepath, "rejected", { rejection_reason: reason });
        log.warn(`Rejected: ${item.frontmatter.id}`);
        rejected++;
        break;
      }

      case "regenerate": {
        const feedback = await input({
          message: "Feedback for regeneration (what should change?):",
        });
        log.info("Regenerating...");

        const systemPrompt = composeSystemPrompt(
          item.frontmatter.channel,
          item.frontmatter.type
        );
        const newBody = await generateContent({
          systemPrompt,
          userMessage: [
            `Regenerate this ${item.frontmatter.type} for ${item.frontmatter.channel}.`,
            "",
            `Original topic: ${item.frontmatter.topic_brief}`,
            "",
            "Previous version:",
            item.body,
            "",
            "Feedback:",
            feedback,
            "",
            "Generate an improved version addressing the feedback.",
          ].join("\n"),
        });

        updateBody(item.filepath, newBody);
        log.success("Regenerated. Review it next pass.");
        break;
      }

      case "ai-review": {
        log.info("Getting AI review...");
        const reviewPrompt = loadReviewPrompt();
        const feedback = await reviewContent(
          `Channel: ${item.frontmatter.channel}\nType: ${item.frontmatter.type}\n\n${item.body}`,
          reviewPrompt
        );
        console.log();
        console.log(feedback);
        console.log();

        // Re-prompt after AI review
        const postReviewAction = await select({
          message: "After AI review:",
          choices: [
            { name: "Approve anyway", value: "approve" },
            { name: "Edit", value: "edit" },
            { name: "Regenerate with AI feedback", value: "regenerate" },
            { name: "Reject", value: "reject" },
            { name: "Skip", value: "skip" },
          ],
        });

        if (postReviewAction === "approve") {
          moveContent(item.filepath, "approved");
          log.success(`Approved: ${item.frontmatter.id}`);
          approved++;
        } else if (postReviewAction === "reject") {
          moveContent(item.filepath, "rejected", { rejection_reason: "Failed AI review" });
          rejected++;
        } else if (postReviewAction === "regenerate") {
          const systemPrompt = composeSystemPrompt(
            item.frontmatter.channel,
            item.frontmatter.type
          );
          const newBody = await generateContent({
            systemPrompt,
            userMessage: [
              `Regenerate this ${item.frontmatter.type} for ${item.frontmatter.channel}.`,
              `Topic: ${item.frontmatter.topic_brief}`,
              "",
              "Previous version:",
              item.body,
              "",
              "AI review feedback:",
              feedback,
              "",
              "Generate an improved version addressing all review feedback.",
            ].join("\n"),
          });
          updateBody(item.filepath, newBody);
          log.success("Regenerated with AI feedback.");
        } else if (postReviewAction === "edit") {
          await openInEditor(item.filepath);
        }
        break;
      }

      case "skip":
        log.dim(`  Skipped: ${item.frontmatter.id}`);
        break;
    }

    reviewed++;
  }

  console.log();
  log.header("Review Summary");
  log.info(`Reviewed: ${reviewed} | Approved: ${approved} | Rejected: ${rejected}`);
}

async function promptReviewAction(): Promise<ReviewAction> {
  const action = await select({
    message: "Action:",
    choices: [
      { name: "Approve", value: "approve" },
      { name: "Edit (open in editor)", value: "edit" },
      { name: "Reject", value: "reject" },
      { name: "Regenerate (with feedback)", value: "regenerate" },
      { name: "AI Review (get Claude's feedback)", value: "ai-review" },
      { name: "Skip", value: "skip" },
    ],
  });

  return { type: action as ReviewAction["type"] };
}

async function openInEditor(filepath: string): Promise<void> {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? "notepad";
  log.info(`Opening in ${editor}...`);
  try {
    execSync(`${editor} "${filepath}"`, { stdio: "inherit" });
  } catch {
    log.warn(`Could not open editor "${editor}". Edit the file manually: ${filepath}`);
    await confirm({ message: "Press Enter when done editing..." });
  }
}
