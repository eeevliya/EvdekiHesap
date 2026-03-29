-- Remove CHF (Swiss Franc) from global symbols.
-- CHF was included in the initial seed but has been removed from the product scope.
delete from symbols where code = 'CHF' and household_id is null;
