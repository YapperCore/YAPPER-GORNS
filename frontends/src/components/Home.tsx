import React, { useState } from "react";
import { Button } from "@/components/ui/button"; // Adjust path as needed

const Home = () => {
  const [file, setFile] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleSubmit = () => {
    // Handle submit logic
  };

  const handleCreateFolder = () => {
    // Handle create folder logic
  };

  return (
    <div className="home-container">
      <div className="upload-section">
        {/* File input as shadcn/ui Button */}
        <label htmlFor="file-upload">
          <Button
            variant="outline"
            size="lg"
            className="font-bold rounded-xl border-yellow-400 text-yellow-700 hover:bg-yellow-50 border-2 shadow-none"
            asChild
          >
            <span>Choose File</span>
          </Button>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        {/* Submit button */}
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="font-bold rounded-xl border-yellow-400 text-yellow-700 hover:bg-yellow-50 border-2 shadow-none"
          onClick={handleSubmit}
        >
          Submit
        </Button>
        {/* Create Folder button */}
        <Button
          variant="outline"
          size="lg"
          className="font-bold rounded-xl border-yellow-400 text-yellow-700 hover:bg-yellow-50 border-2 shadow-none"
          onClick={handleCreateFolder}
        >
          Create Folder
        </Button>
      </div>
      {/* ...existing code... */}
    </div>
  );
};

export default Home;