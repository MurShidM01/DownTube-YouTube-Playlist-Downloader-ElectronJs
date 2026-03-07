const ErrorHandler = require('./errorHandler');

class RetryManager {
    static async withRetry(operation, maxRetries = 3, delay = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (error.type === ErrorHandler.errorTypes.VALIDATION) {
                    throw error;
                }

                if (error.type === ErrorHandler.errorTypes.FILE_SYSTEM && !ErrorHandler.isNetworkError(error)) {
                    throw error;
                }

                if (attempt < maxRetries) {
                    console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                }
            }
        }

        throw lastError;
    }
}

module.exports = RetryManager;
