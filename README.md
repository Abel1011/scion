# Scion

Branch your production database as easily as you branch your code. Scion creates a full, isolated, PII-free copy of your Amazon Aurora database on demand, so any developer can build against and preview real, production-shaped data without ever touching production and without ever exposing a real customer. Spinning up that branch is meant to feel as ordinary as creating a git branch, and that ease is the point. A pull request is the natural trigger for it, and reviewing and promoting the schema change back to production is what closes the loop.

Built for the H0 hackathon (Hack the Zero Stack with Vercel and AWS Databases), Monetizable B2B App track.

## The problem it solves

Engineering teams that run a real production database have a gap in their workflow. Their application code already moves through pull requests, preview deployments, and review. Their database does not. When someone opens a pull request that adds a column, drops a table, or changes a type, there is usually no safe place to see that change run against data that looks like production. People end up testing against a tiny seed database that hides every real problem, against a stale shared staging database that three other branches are also mutating, or worst of all against production itself.

The teams that feel this most are the ones shipping on Vercel with a production Postgres on Amazon Aurora. Their previews are first-class for the frontend and nonexistent for the database. Scion closes that gap. It is aimed at backend and full-stack teams who care that a migration is reversible, that a preview reflects real data shapes and volumes, and that no engineer ever has a customer email or card number sitting in a throwaway environment.

## How a branch works

Creating a branch is a single action, a click in Scion or an opened pull request, and the control plane runs a short sequence:

1. It makes a copy-on-write clone of your production Aurora cluster. The clone shares storage pages with production until something writes to it, so it is created in seconds and costs almost nothing, no matter how large production is.
2. It anonymizes the personal data on that clone in place. Names, emails, and card numbers are replaced by deterministic, foreign-key-safe stand-ins, so joins still work and no real customer survives the copy. Production is never modified by this step.
3. It applies the pull request migration to the clone, so the branch now has the new schema running against realistic, masked data.
4. It opens a deploy request that holds the actual schema difference between the branch and production, flags anything destructive, and waits for a human to approve it.
5. It can wire the branch connection string into that pull request preview on Vercel, so the deployed preview runs against the isolated branch.

When the pull request closes, the clone is torn down and the branch row is kept as an audit record. The real Aurora resources are deleted, so nothing lingers as cost.

## Why Amazon Aurora PostgreSQL

Scion uses Amazon Aurora PostgreSQL Serverless v2 because Aurora is the one offered database whose copy-on-write cloning makes branching easy and cheap enough to do for everyone, every time. It can hand over a full, production-sized database in minutes at near-zero storage cost, and that capability is what the whole product is built on rather than a detail it happens to use.

This choice is intentional and not interchangeable. Aurora DSQL and DynamoDB are excellent databases, but neither gives you a storage-level, zero-copy clone of an existing relational database that you can immediately connect to, mutate, and throw away. The clone is created with `RestoreDBClusterToPointInTime` using `RestoreType: copy-on-write`, and the time to create it does not depend on the size of the source. A snapshot and restore of a large database takes hours and a full second copy of storage. An Aurora clone takes minutes and pays only for the pages a branch changes. Without that primitive, branching a production database per pull request is not economically viable, so the database is not a backend that the product happens to talk to. The database capability is the product.

Aurora Serverless v2 also lets each branch scale its compute to zero when idle, which keeps a fleet of short-lived previews cheap, and Scion provisions every clone instance as `db.serverless` with a minimum capacity of zero for exactly that reason.

## The control plane and data model

Scion is a control plane, not the application being branched. It keeps its own state in a dedicated Aurora PostgreSQL database, modeled with Drizzle ORM, and that model reflects the real shape of the problem rather than a single flat table.

A project represents one production database. Each project has one golden, which is the production Aurora cluster that branches are cloned from, derived automatically from the connection you configure rather than entered by hand. Aurora allows fifteen clones per copy-on-write lineage, so each golden tracks its lineage depth, and the design rolls a fresh golden from production when one fills up, which keeps the fifteen-clone ceiling from ever becoming a wall. Every branch records its data mode, its provisioning status, the cluster and instance it owns, its connection host, a lease for automatic cleanup, and the migration it carries. A deploy request holds the schema diff, the lint findings, the destructive flag, and the up and down migration SQL for a change that is on its way to production. A masking policy and its rules declare which columns are personal data and how to anonymize them. A small jobs table backs a durable work queue, and an events table records the full timeline of every branch for auditing.

Provisioning is the part that needed real engineering rather than a single call. Standing up a fresh Aurora Serverless v2 instance takes a few minutes, which is far longer than a serverless function is allowed to run. Scion solves this with a resumable state machine driven by a worker that is invoked repeatedly. Each invocation advances a branch as far as it can without blocking. It issues the clone, then polls until the new instance reports available, then runs masking and the migration, then opens the deploy request. Because the state machine is idempotent and the work is queued, the same flow runs whether it is triggered from the dashboard, from a Vercel cron, or from a GitHub webhook, and it survives the time limits of a serverless platform instead of fighting them.

## Schema changes as deploy requests

A deploy request is what closes the loop. The branch is where you build and test a change with ease, and the deploy request is where you review it and promote it to production. It is created automatically when a branch carries a migration, and it is where a schema change is reviewed before it reaches production.

The diff is real. Scion introspects `information_schema` on both the branch clone and production, compares the two schemas column by column, and produces an added and removed view of the change rather than echoing back the SQL you typed. When a change drops a column or a table, Scion counts the rows currently at risk on production and surfaces that count in plain language, so a reviewer sees "deletes users.card, 12 rows at risk" instead of a generic warning. Applying a change runs the real data definition SQL against production, refuses to apply a destructive change without an explicit confirmation, recomputes the diff first so it catches schema drift that happened outside Scion, and fails cleanly if the change conflicts with the current state of production. Reverting runs the down migration. Nothing about this flow is simulated when Scion is pointed at real Aurora.

## Keeping production data private

Personal data is masked on the clone and only on the clone. Scion never copies your users into its own database, and it never runs masking against production. When a branch is provisioned, Scion runs deterministic, foreign-key-safe `UPDATE` statements on the clone that replace declared personal columns, so an email becomes a redacted address, a name becomes a stable pseudonym, and a card number keeps its last four digits and nothing else. Because the replacements are deterministic, the same source value always maps to the same masked value, which means foreign keys and joins across tables stay intact. A branch can also be created in a schema-only mode that truncates every table, so a developer who needs a clean, empty, production-shaped schema gets one with no rows at all.

The result is a branch that has the exact shape and the realistic volume of production with none of the real people in it, which is the property that makes it safe to hand to a preview deployment that anyone on the team can open.

## Connecting it to Vercel

Vercel is an optional integration rather than the center of the product. You configure a Vercel token once and pick the project from a list inside Scion. From then on a branch can inject its connection string into that project as a preview-scoped environment variable, keyed to the git branch, and trigger a redeploy so the preview rebuilds against the isolated branch. The injection only ever writes to the preview target for a specific branch, so the production and development environments are never touched. Automatic provisioning from a GitHub pull request webhook is supported and is off by default, which keeps branch creation deliberate and keeps a public deployment from spinning up real Aurora clusters by surprise.

## The user experience

The dashboard reads like a control plane for your database, not a settings page. Production sits at the top of a lineage view and is always highlighted, and the branches grow out of it as tagged nodes that show their status and data mode at a glance. A branch opens into a drawer with its live timeline, a copyable connection string, a preview of its masked data, and its actions. Deploy requests have their own history with the diff, the data-loss warnings, and approve, reject, and roll back. The visual language is deliberately its own, a light paper background with a forest-green accent and the Space Grotesk and Space Mono typefaces, so the product feels like a considered tool rather than a generic admin template, and a single mode indicator always tells you whether you are looking at a real Aurora run or a simulated one.

## Tech stack

The frontend and the control plane are one Next.js 16 application using the App Router and React 19, deployed on Vercel. Data access uses Drizzle ORM over postgres.js against Amazon Aurora PostgreSQL. Cloning, instance lifecycle, and teardown go through the AWS SDK for JavaScript v3 and the RDS client. The interface is styled with Tailwind CSS v4 and uses lucide icons. The demo application that gets branched is a small separate Next.js storefront that reads its database connection from an environment variable, which is exactly how a real customer application would consume a Scion branch.

## Running it

```bash
npm install
cp .env.example .env   # set your Aurora and AWS values
npm run db:push        # create the control plane schema
npm run db:seed        # one production golden and the masking policy
npm run dev
```

Configuration lives in the environment, and any of it can be overridden at runtime from the Settings page, which keeps credentials write-only in the interface while letting you bring your own Aurora cluster, AWS account, and Vercel project. A provisioner switch lets you run the whole flow in a simulated mode for a fast walkthrough, or against real Aurora for the genuine copy-on-write lifecycle.

## What is real today

The full data path runs against real Amazon Aurora. A branch is a genuine copy-on-write clone, the masking runs as real SQL on that clone, the schema diff is a real introspection of production against the branch, and approving a deploy request runs real data definition SQL against the production cluster with a conflict check. The provisioning state machine, the lineage accounting, the lease based cleanup, and the masking policy are all wired end to end and have been exercised against a live cluster.

## Architecture at a glance

```
Pull request or dashboard action
        |
        v
Scion control plane  (Next.js on Vercel)
        |   a worker advances a resumable state machine
        v
Amazon Aurora PostgreSQL  (golden = production)
        |   copy-on-write clone
        v
Aurora branch  (Serverless v2)
   • PII masked in place
   • pull request migration applied
        |   branch connection string
        v
Vercel preview deployment

A deploy request reviews the schema diff, then applies or reverts it on production.
```
