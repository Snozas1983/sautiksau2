-- Add end_date column to schedule_exceptions for date range support
ALTER TABLE schedule_exceptions 
ADD COLUMN end_date date NULL;

COMMENT ON COLUMN schedule_exceptions.end_date IS 
'Pabaigos data intervalui. Jei nustatyta kartu su date, blokuoja visas dienas nuo date iki end_date.';