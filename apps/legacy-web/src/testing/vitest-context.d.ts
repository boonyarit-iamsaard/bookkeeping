// The integration project injects the test database URL from the database
// package's global setup; this pulls its `ProvidedContext` augmentation into
// the web type program now that no web test imports the package directly.
import "@bookkeeping/database/testing";
