import React from 'react';
import Navbar from '../components/Navbar/Navbar';
import TrashBucket from '../components/TrashBucket/TrashBucket';

const Trash = () => {
  return (
    <div className="trash-page">
      <Navbar />
      <TrashBucket />
    </div>
  );
};

export default Trash;
