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

- [x] Stack deployed to `ap-southeast-1` in `backups`; the outputs are recorded under Comments.
- [x] Budget email confirmed received or subscribed.
- [x] Access key created for `bookkeeping-backup-uploader`; its creation date and the next replacement date (one year later) recorded under Comments.
- [x] As the uploader: uploading `daily/test/probe.txt` succeeds; listing the bucket, reading that object, and deleting it are refused.
- [x] As the owner: deleting that object's version is refused because of Object Lock.
- [ ] October 2026's AWS cost noted under Comments once that bill is issued, about 2026-11-03. The stack went live on 2026-10-18, so October is a partial month of 14 days.

## Comments

### 2026-10-18: Stack deployed

The `bookkeeping-backups` stack reached `CREATE_COMPLETE` in
`ap-southeast-1` in the `backups` account, after its change set was
reviewed. Outputs:

- `BucketName`: `<BUCKET_NAME>`. The bucket is in the account regional
  namespace, so its real name is `bookkeeping-backups-<BACKUPS_ACCOUNT_ID>-ap-southeast-1-an`.
  The repository is public, so only the placeholder is recorded here. Read
  the real name with `aws cloudformation describe-stacks --profile bookkeeping-backups --region ap-southeast-1 --stack-name bookkeeping-backups --query "Stacks[0].Outputs"`;
  it also goes into the `backup` service's `BACKUP_BUCKET` in 04.
- `UploaderUserName`: `bookkeeping-backup-uploader`.

The template was switched to the account regional namespace before deploy.
The runbook is `../runbooks/03-deploy-storage-and-uploader-key.md`.

### 2026-10-18: Budget subscribed

`bookkeeping-backups-monthly` is a $1 monthly cost budget. Its 80% actual
and 100% forecast notifications each email the owner directly, with no SNS
topic, so there is no subscription to confirm. AWS needs about five weeks of
usage before a forecast alert can fire, so the forecast alert can't trigger
before late November 2026.

### 2026-10-18: Uploader access key

One access key exists for `bookkeeping-backup-uploader`, tagged `railway
backup job`.

- Created: 2026-10-18 (10:43 UTC).
- Replace by: 2027-10-18. Create the new key, update the `backup` service's
  variables, confirm the next nightly upload, then delete the old key.
  Replace it at once if exposure is suspected.

The secret was never written to a file or pasted into a conversation.

### 2026-10-18: Uploader checks

With the uploader's key kept in a subshell, uploading `daily/test/probe.txt`
succeeded. Listing the bucket (`s3:ListBucket`), reading the object
(`HeadObject` 403) and deleting it (`s3:DeleteObject`) were all refused. The
probe is locked in compliance mode until 2026-11-22 and carries a
`CRC64NVME` checksum, which AWS CLI 2.38.1 sent by default. Ticket 04
should confirm that Alpine's `aws-cli` does the same. The probe stays under
`daily/` until lifecycle expires it, so ticket 05's check will count it as
the newest backup if it runs within 26 hours of 2026-10-18 10:49 UTC.

### 2026-10-18: Owner delete refused

As the owner, with `AdministratorAccess` in `backups`, deleting the probe's
version by its version ID failed with `AccessDenied ... because object
protected by object lock`. The version is still there, with no delete
marker.

### 2026-10-23: The cost check moves to October

The owner chose October's partial bill over waiting for November, the first
full month. At tens of KB a night, two weeks already shows whether the cost
rounds to zero, and the wait would only add a December reminder. On
2026-10-23 the owner read October's month-to-date cost in the Billing
console: $0.00. The October bill is final once its status changes from
**Pending** to **Issued**, about 2026-11-03.
