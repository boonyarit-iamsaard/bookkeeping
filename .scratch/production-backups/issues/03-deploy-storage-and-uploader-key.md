# 03: Deploy the storage stack and create the uploader key

Read `../spec.md` first (Storage, Uploader, Testing Decisions).

**What to build:** The storage stack runs in the `backups` account, its
protections are proven, and the uploader's access key exists, ready for the
Railway service in 04.

**Blocked by:** 01, 02

**Status:** ready-for-human

**Notes:** The owner deploys and creates the key. The secret access key goes
straight into Railway's variables in 04 and is never written to a file or
pasted into a conversation.

- [ ] Stack deployed to `ap-southeast-1` in `backups`; the outputs are recorded under Comments.
- [ ] Budget email confirmed received or subscribed.
- [ ] Access key created for `bookkeeping-backup-uploader`; its creation date and the next replacement date (one year later) recorded under Comments.
- [ ] As the uploader: uploading `daily/test/probe.txt` succeeds; listing the bucket, reading that object, and deleting it are refused.
- [ ] As the owner: deleting that object's version is refused because of Object Lock.
- [ ] The first month's AWS cost noted under Comments once the billing period ends.

## Comments
